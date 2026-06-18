package ocrself

import "github.com/BaizorAI/new-api/relay/channel/ocrali"

// Re-export ocrali DTOs so the self-hosted OCR service can reuse the same
// request/response contract as Alibaba Cloud OCR without duplicating types.
type OCRRequest = ocrali.OCRRequest
type OCRResponse = ocrali.OCRResponse
type OCRData = ocrali.OCRData
type OCRSubImage = ocrali.OCRSubImage
type OCRKVInfo = ocrali.OCRKVInfo
type OCRKVDetail = ocrali.OCRKVDetail
type OCRQualityInfo = ocrali.OCRQualityInfo

// ModelToOCRType maps internal model names to OCR Type values.
var ModelToOCRType = ocrali.ModelToOCRType
