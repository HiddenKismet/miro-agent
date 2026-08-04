// Package rpc drives the Miro engine (a pi --mode rpc subprocess) with
// JSONL commands/events.
package rpc

import (
	"bufio"
	"encoding/json"
	"fmt"
	"io"
	"os"
	"os/exec"
	"sync"
	"sync/atomic"
	"time"
)

// Event is one JSONL line from the engine stdout.
type Event struct {
	Type string
	Raw  json.RawMessage
	Data map[string]any
}

// Client manages the engine subprocess.
type Client struct {
	cmd    *exec.Cmd
	stdin  io.WriteCloser
	events chan Event
	done   chan struct{}
	nextID atomic.Int64

	mu      sync.Mutex
	alive   bool
	pending map[int64]chan map[string]any
}

// New spawns the engine with the given binary and args.
func New(bin string, args ...string) (*Client, error) {
	full := append([]string{"--mode", "rpc"}, args...)
	cmd := exec.Command(bin, full...)
	cmd.Env = os.Environ()
	cmd.Stderr = os.Stderr

	stdin, err := cmd.StdinPipe()
	if err != nil {
		return nil, err
	}
	stdout, err := cmd.StdoutPipe()
	if err != nil {
		return nil, err
	}
	if err := cmd.Start(); err != nil {
		return nil, fmt.Errorf("spawn engine: %w", err)
	}

	c := &Client{
		cmd:     cmd,
		stdin:   stdin,
		events:  make(chan Event, 256),
		done:    make(chan struct{}),
		alive:   true,
		pending: make(map[int64]chan map[string]any),
	}
	go c.readLoop(stdout)
	return c, nil
}

func (c *Client) readLoop(r io.Reader) {
	defer close(c.done)
	scanner := bufio.NewScanner(r)
	scanner.Buffer(make([]byte, 1<<20), 1<<24)
	for scanner.Scan() {
		line := scanner.Bytes()
		if len(line) == 0 {
			continue
		}
		var data map[string]any
		if err := json.Unmarshal(line, &data); err != nil {
			continue
		}
		typ, _ := data["type"].(string)

		// command responses are correlated, not broadcast
		if typ == "response" {
			if id, ok := toInt64(data["id"]); ok {
				c.mu.Lock()
				ch := c.pending[id]
				delete(c.pending, id)
				c.mu.Unlock()
				if ch != nil {
					select {
					case ch <- data:
					default:
					}
				}
			}
			continue
		}

		raw := make(json.RawMessage, len(line))
		copy(raw, line)
		select {
		case c.events <- Event{Type: typ, Raw: raw, Data: data}:
		default:
			// drop when consumer is stalled; never block the engine pipe
		}
	}
	c.mu.Lock()
	c.alive = false
	for _, ch := range c.pending {
		close(ch)
	}
	c.pending = make(map[int64]chan map[string]any)
	c.mu.Unlock()
}

// Events returns the broadcast event channel.
func (c *Client) Events() <-chan Event { return c.events }

// Done closes when the engine process output ends.
func (c *Client) Done() <-chan struct{} { return c.done }

// Alive reports whether the subprocess is still producing.
func (c *Client) Alive() bool {
	c.mu.Lock()
	defer c.mu.Unlock()
	return c.alive
}

// SendUserMessage queues a user message and returns a response waiter.
func (c *Client) SendUserMessage(text string) error {
	return c.send(map[string]any{
		"type":    "prompt",
		"message": text,
	})
}

// Call sends a command and blocks until the correlated response arrives.
// Returns the response payload (or an error on timeout / process death).
func (c *Client) Call(command map[string]any) (map[string]any, error) {
	id := c.nextID.Add(1)
	command["id"] = id
	data, err := json.Marshal(command)
	if err != nil {
		return nil, err
	}
	c.mu.Lock()
	if !c.alive {
		c.mu.Unlock()
		return nil, fmt.Errorf("engine subprocess is not running")
	}
	ch := make(chan map[string]any, 1)
	c.pending[id] = ch
	c.mu.Unlock()

	if _, err = c.stdin.Write(append(data, '\n')); err != nil {
		c.mu.Lock()
		delete(c.pending, id)
		c.mu.Unlock()
		return nil, err
	}

	select {
	case resp := <-ch:
		return resp, nil
	case <-c.done:
		return nil, fmt.Errorf("engine subprocess exited")
	}
}

// CallTimeout is Call with a timeout; a timeout removes the pending waiter.
func (c *Client) CallTimeout(command map[string]any, timeout time.Duration) (map[string]any, error) {
	id := c.nextID.Add(1)
	command["id"] = id
	data, err := json.Marshal(command)
	if err != nil {
		return nil, err
	}
	c.mu.Lock()
	if !c.alive {
		c.mu.Unlock()
		return nil, fmt.Errorf("engine subprocess is not running")
	}
	ch := make(chan map[string]any, 1)
	c.pending[id] = ch
	c.mu.Unlock()

	if _, err = c.stdin.Write(append(data, '\n')); err != nil {
		c.mu.Lock()
		delete(c.pending, id)
		c.mu.Unlock()
		return nil, err
	}

	timer := time.NewTimer(timeout)
	defer timer.Stop()
	select {
	case resp := <-ch:
		return resp, nil
	case <-c.done:
		return nil, fmt.Errorf("engine subprocess exited")
	case <-timer.C:
		c.mu.Lock()
		delete(c.pending, id)
		c.mu.Unlock()
		return nil, fmt.Errorf("timeout waiting for response")
	}
}

// Abort interrupts the current turn.
func (c *Client) Abort() error {
	return c.send(map[string]any{"type": "abort"})
}

func (c *Client) send(command map[string]any) error {
	id := c.nextID.Add(1)
	command["id"] = id
	data, err := json.Marshal(command)
	if err != nil {
		return err
	}
	c.mu.Lock()
	if !c.alive {
		c.mu.Unlock()
		return fmt.Errorf("engine subprocess is not running")
	}
	c.mu.Unlock()
	_, err = c.stdin.Write(append(data, '\n'))
	return err
}

// Close terminates the subprocess and waits for it to be reaped, so no
// stray engine keeps writing into our (soon to be closed) stdout pipe.
func (c *Client) Close() {
	_ = c.stdin.Close()
	if c.cmd.Process != nil {
		_ = c.cmd.Process.Kill()
		_ = c.cmd.Wait()
	}
}

func toInt64(v any) (int64, bool) {
	switch n := v.(type) {
	case float64:
		return int64(n), true
	case int64:
		return n, true
	case json.Number:
		i, err := n.Int64()
		return i, err == nil
	}
	return 0, false
}
