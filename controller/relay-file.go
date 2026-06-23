package controller

import (
	"errors"
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"time"

	"github.com/BaizorAI/new-api/model"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

const filesUploadDir = "data/files"

func init() {
	if err := os.MkdirAll(filesUploadDir, 0o755); err != nil {
		panic(fmt.Sprintf("cannot create files upload directory %s: %v", filesUploadDir, err))
	}
}

// ---------------------------------------------------------------------------
// DTO types for the OpenAI Files API surface
// ---------------------------------------------------------------------------

type openaiFileObject struct {
	ID        int    `json:"id"`
	Object    string `json:"object"`
	Bytes     int64  `json:"bytes"`
	CreatedAt int64  `json:"created_at"`
	Filename  string `json:"filename"`
	Purpose   string `json:"purpose"`
}

type openaiFileList struct {
	Object string             `json:"object"`
	Data   []openaiFileObject `json:"data"`
}

type openaiFileDeleted struct {
	ID      int    `json:"id"`
	Object  string `json:"object"`
	Deleted bool   `json:"deleted"`
}

func fileToOpenAIObject(f *model.File) openaiFileObject {
	return openaiFileObject{
		ID:        f.ID,
		Object:    "file",
		Bytes:     f.Bytes,
		CreatedAt: f.CreatedAt.Unix(),
		Filename:  f.Filename,
		Purpose:   f.Purpose,
	}
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

func getFileUserId(c *gin.Context) int {
	return c.GetInt("id")
}

func fileNotFoundResponse(id int) gin.H {
	return gin.H{
		"error": map[string]string{
			"message": fmt.Sprintf("No file found with id '%d'", id),
			"type":    "invalid_request_error",
			"code":    "file_not_found",
		},
	}
}

func getFileOwnedByUser(id, userId int) (*model.File, error) {
	var f model.File
	err := model.DB.Where("id = ? AND user_id = ?", id, userId).First(&f).Error
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, nil
		}
		return nil, err
	}
	return &f, nil
}

// ---------------------------------------------------------------------------
// POST /v1/files  —  Upload a file
// ---------------------------------------------------------------------------

func RelayFilesUpload(c *gin.Context) {
	userId := getFileUserId(c)

	form, err := c.MultipartForm()
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": map[string]string{
				"message": "Expected multipart/form-data with a 'file' field and a 'purpose' field.",
				"type":    "invalid_request_error",
			},
		})
		return
	}

	purpose := strings.TrimSpace(c.PostForm("purpose"))
	if purpose == "" {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": map[string]string{
				"message": "Missing required 'purpose' field.",
				"type":    "invalid_request_error",
				"code":    "missing_purpose",
			},
		})
		return
	}

	files := form.File["file"]
	if len(files) == 0 {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": map[string]string{
				"message": "Missing required 'file' field.",
				"type":    "invalid_request_error",
				"code":    "missing_file",
			},
		})
		return
	}

	upload := files[0]
	src, err := upload.Open()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": map[string]string{
				"message": "Failed to open uploaded file.",
				"type":    "server_error",
			},
		})
		return
	}
	defer src.Close()

	diskFilename := fmt.Sprintf("%d_%d_%s", userId, time.Now().UnixNano(), upload.Filename)
	diskPath := filepath.Join(filesUploadDir, diskFilename)

	dst, err := os.Create(diskPath)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": map[string]string{
				"message": "Failed to store uploaded file.",
				"type":    "server_error",
			},
		})
		return
	}

	written, err := io.Copy(dst, src)
	dst.Close()
	if err != nil {
		os.Remove(diskPath)
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": map[string]string{
				"message": "Failed to write uploaded file.",
				"type":    "server_error",
			},
		})
		return
	}

	fileRecord := &model.File{
		UserID:   userId,
		Filename: upload.Filename,
		Purpose:  purpose,
		Bytes:    written,
		DiskPath: diskPath,
		MimeType: upload.Header.Get("Content-Type"),
	}
	if err := model.DB.Create(fileRecord).Error; err != nil {
		os.Remove(diskPath)
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": map[string]string{
				"message": "Failed to save file record.",
				"type":    "server_error",
			},
		})
		return
	}

	c.JSON(http.StatusOK, fileToOpenAIObject(fileRecord))
}

// ---------------------------------------------------------------------------
// GET /v1/files  —  List files
// ---------------------------------------------------------------------------

func RelayFilesList(c *gin.Context) {
	userId := getFileUserId(c)
	purposeParam := strings.TrimSpace(c.Query("purpose"))

	var files []model.File
	q := model.DB.Where("user_id = ?", userId)
	if purposeParam != "" {
		q = q.Where("purpose = ?", purposeParam)
	}
	if err := q.Order("id desc").Find(&files).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": map[string]string{
				"message": "Failed to list files.",
				"type":    "server_error",
			},
		})
		return
	}

	data := make([]openaiFileObject, 0, len(files))
	for i := range files {
		data = append(data, fileToOpenAIObject(&files[i]))
	}

	c.JSON(http.StatusOK, openaiFileList{
		Object: "list",
		Data:   data,
	})
}

// ---------------------------------------------------------------------------
// GET /v1/files/:id  —  Retrieve file metadata
// ---------------------------------------------------------------------------

func RelayFilesRetrieve(c *gin.Context) {
	userId := getFileUserId(c)
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": map[string]string{
				"message": "Invalid file id.",
				"type":    "invalid_request_error",
			},
		})
		return
	}

	f, err := getFileOwnedByUser(id, userId)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": map[string]string{
				"message": "Failed to retrieve file.",
				"type":    "server_error",
			},
		})
		return
	}
	if f == nil {
		c.JSON(http.StatusNotFound, fileNotFoundResponse(id))
		return
	}

	c.JSON(http.StatusOK, fileToOpenAIObject(f))
}

// ---------------------------------------------------------------------------
// DELETE /v1/files/:id  —  Delete a file
// ---------------------------------------------------------------------------

func RelayFilesDelete(c *gin.Context) {
	userId := getFileUserId(c)
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": map[string]string{
				"message": "Invalid file id.",
				"type":    "invalid_request_error",
			},
		})
		return
	}

	f, err := getFileOwnedByUser(id, userId)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": map[string]string{
				"message": "Failed to retrieve file.",
				"type":    "server_error",
			},
		})
		return
	}
	if f == nil {
		c.JSON(http.StatusNotFound, fileNotFoundResponse(id))
		return
	}

	// Remove from disk (best-effort; don't fail the API call if gone already).
	os.Remove(f.DiskPath)

	if err := model.DB.Delete(f).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": map[string]string{
				"message": "Failed to delete file.",
				"type":    "server_error",
			},
		})
		return
	}

	c.JSON(http.StatusOK, openaiFileDeleted{
		ID:      f.ID,
		Object:  "file",
		Deleted: true,
	})
}

// ---------------------------------------------------------------------------
// GET /v1/files/:id/content  —  Download file content
// ---------------------------------------------------------------------------

func RelayFilesContent(c *gin.Context) {
	userId := getFileUserId(c)
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": map[string]string{
				"message": "Invalid file id.",
				"type":    "invalid_request_error",
			},
		})
		return
	}

	f, err := getFileOwnedByUser(id, userId)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": map[string]string{
				"message": "Failed to retrieve file.",
				"type":    "server_error",
			},
		})
		return
	}
	if f == nil {
		c.JSON(http.StatusNotFound, fileNotFoundResponse(id))
		return
	}

	content, err := os.ReadFile(f.DiskPath)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": map[string]string{
				"message": "Failed to read file content from disk.",
				"type":    "server_error",
			},
		})
		return
	}

	contentType := f.MimeType
	if contentType == "" {
		contentType = "application/octet-stream"
	}
	c.Data(http.StatusOK, contentType, content)
}
