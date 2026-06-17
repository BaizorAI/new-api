package common

import (
	"crypto/rand"
	"encoding/hex"
	"sync"
	"time"
)

// CliLoginSession represents a pending CLI login session.
type CliLoginSession struct {
	Token     string `json:"token"`
	Key       string `json:"key,omitempty"`
	Status    string `json:"status"` // "pending" or "done"
	CreatedAt int64  `json:"created_at"`
}

// CliLoginStore is an in-memory store for CLI login sessions.
type CliLoginStore struct {
	mu       sync.RWMutex
	sessions map[string]*CliLoginSession
}

var cliLoginStoreInstance *CliLoginStore
var cliLoginStoreOnce sync.Once

// GetCliLoginStore returns the singleton CLI login session store.
func GetCliLoginStore() *CliLoginStore {
	cliLoginStoreOnce.Do(func() {
		store := &CliLoginStore{
			sessions: make(map[string]*CliLoginSession),
		}
		cliLoginStoreInstance = store
		// Start background cleanup of expired sessions (every 2 minutes, remove sessions older than 10 minutes)
		go store.cleanupLoop(2*time.Minute, 10*time.Minute)
	})
	return cliLoginStoreInstance
}

// GenerateCliToken generates a random 32-char hex token for CLI login.
func GenerateCliToken() (string, error) {
	bytes := make([]byte, 16)
	if _, err := rand.Read(bytes); err != nil {
		return "", err
	}
	return hex.EncodeToString(bytes), nil
}

// CreateSession creates a new pending CLI login session and returns its token.
func (s *CliLoginStore) CreateSession() (string, error) {
	token, err := GenerateCliToken()
	if err != nil {
		return "", err
	}

	s.mu.Lock()
	defer s.mu.Unlock()

	s.sessions[token] = &CliLoginSession{
		Token:     token,
		Status:    "pending",
		CreatedAt: time.Now().Unix(),
	}
	return token, nil
}

// SubmitKey associates an API key with a CLI login session.
// Creates the session if it doesn't exist yet.
func (s *CliLoginStore) SubmitKey(token, key string) {
	s.mu.Lock()
	defer s.mu.Unlock()

	if session, ok := s.sessions[token]; ok {
		session.Key = key
		session.Status = "done"
		return
	}

	s.sessions[token] = &CliLoginSession{
		Token:     token,
		Key:       key,
		Status:    "done",
		CreatedAt: time.Now().Unix(),
	}
}

// PollSession returns the session for the given token.
// Auto-creates a pending session if it doesn't exist yet.
func (s *CliLoginStore) PollSession(token string) *CliLoginSession {
	s.mu.Lock()
	defer s.mu.Unlock()

	if session, ok := s.sessions[token]; ok {
		return session
	}

	session := &CliLoginSession{
		Token:     token,
		Status:    "pending",
		CreatedAt: time.Now().Unix(),
	}
	s.sessions[token] = session
	return session
}

// DeleteSession removes a session (called after successful key retrieval).
func (s *CliLoginStore) DeleteSession(token string) {
	s.mu.Lock()
	defer s.mu.Unlock()
	delete(s.sessions, token)
}

func (s *CliLoginStore) cleanupLoop(interval, maxAge time.Duration) {
	ticker := time.NewTicker(interval)
	defer ticker.Stop()

	for range ticker.C {
		s.mu.Lock()
		now := time.Now().Unix()
		maxAgeSec := int64(maxAge.Seconds())
		for token, session := range s.sessions {
			if now-session.CreatedAt > maxAgeSec {
				delete(s.sessions, token)
			}
		}
		s.mu.Unlock()
	}
}
