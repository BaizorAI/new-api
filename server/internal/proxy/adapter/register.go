package adapter

import (
	"baizor-new-api/server/internal/proxy/adapter"
)

// Re-export the register function from the package root.
var Register = adapter.Register

func init() {
	_ = Register
}
