package model

import (
	"time"

	"gorm.io/gorm"
)

// File represents a stored file uploaded through the OpenAI-compatible
// Files API.  File content lives on disk under files/; this row
// holds the metadata.
type File struct {
	ID        int            `json:"id" gorm:"primaryKey"`
	UserID    int            `json:"-" gorm:"index;not null"`
	Filename  string         `json:"filename" gorm:"not null"`
	Purpose   string         `json:"purpose" gorm:"not null"`
	Bytes     int64          `json:"bytes" gorm:"not null"`
	DiskPath  string         `json:"-" gorm:"not null"`
	MimeType  string         `json:"-" gorm:"not null"`
	CreatedAt time.Time      `json:"created_at"`
	DeletedAt gorm.DeletedAt `json:"-" gorm:"index"`
}

// // TableName returns "files" to match the OpenAI API concept.
// NOTE: GORM already pluralizes "File" → "files" by default.
