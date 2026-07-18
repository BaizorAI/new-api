package model

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestEscapeLikePattern(t *testing.T) {
	assert.Equal(t, "hello", escapeLikePattern("hello"))
	assert.Equal(t, "!%test!_bang!!", escapeLikePattern("%test_bang!"))
}

func TestTagMatchPatterns(t *testing.T) {
	patterns := tagMatchPatterns("go")
	require.Len(t, patterns, 4)
	assert.Equal(t, "go,%", patterns[0])
	assert.Equal(t, "%,go,%", patterns[1])
	assert.Equal(t, "%,go", patterns[2])
	assert.Equal(t, "go", patterns[3])
}

func TestTagMatchPatternsEscapesWildcards(t *testing.T) {
	patterns := tagMatchPatterns("a_b")
	require.Len(t, patterns, 4)
	assert.Equal(t, "a!_b,%", patterns[0])
}

func TestSearchPublishedBlogArticles(t *testing.T) {
	truncateTables(t)

	now := int64(1000)
	articles := []*BlogArticle{
		{Id: 1, AuthorId: 1, Title: "Go Intro", Summary: "learn go", Content: "content a", Tags: "go,programming", Status: BlogArticleStatusPublished, PublishedAt: now},
		{Id: 2, AuthorId: 1, Title: "Python Intro", Summary: "learn python", Content: "content b", Tags: "python,programming", Status: BlogArticleStatusPublished, PublishedAt: now + 1},
		{Id: 3, AuthorId: 1, Title: "Draft Article", Summary: "go draft", Content: "content c", Tags: "go", Status: BlogArticleStatusDraft, PublishedAt: now + 2},
	}
	for _, a := range articles {
		require.NoError(t, DB.Create(a).Error)
	}

	got, total, err := SearchPublishedBlogArticles("go", nil, 0, 10)
	require.NoError(t, err)
	assert.Equal(t, int64(1), total)
	require.Len(t, got, 1)
	assert.Equal(t, "Go Intro", got[0].Title)

	got, total, err = SearchPublishedBlogArticles("", []string{"programming"}, 0, 10)
	require.NoError(t, err)
	assert.Equal(t, int64(2), total)
	assert.ElementsMatch(t, []string{"Go Intro", "Python Intro"}, []string{got[0].Title, got[1].Title})

	got, total, err = SearchPublishedBlogArticles("learn", []string{"go"}, 0, 10)
	require.NoError(t, err)
	assert.Equal(t, int64(1), total)
	assert.Equal(t, "Go Intro", got[0].Title)
}

func TestGetRelatedPublishedArticles(t *testing.T) {
	truncateTables(t)

	now := int64(1000)
	articles := []*BlogArticle{
		{Id: 1, AuthorId: 1, Title: "Go Basics", Summary: "", Content: "", Tags: "go,programming", Status: BlogArticleStatusPublished, PublishedAt: now},
		{Id: 2, AuthorId: 1, Title: "Go Advanced", Summary: "", Content: "", Tags: "go,programming", Status: BlogArticleStatusPublished, PublishedAt: now + 1},
		{Id: 3, AuthorId: 1, Title: "Python Basics", Summary: "", Content: "", Tags: "python,programming", Status: BlogArticleStatusPublished, PublishedAt: now + 2},
		{Id: 4, AuthorId: 1, Title: "Cooking", Summary: "", Content: "", Tags: "food", Status: BlogArticleStatusPublished, PublishedAt: now + 3},
	}
	for _, a := range articles {
		require.NoError(t, DB.Create(a).Error)
	}

	// Article 2 shares both tags with article 1; article 3 shares one tag.
	got, total, err := GetRelatedPublishedArticles(1, []string{"go", "programming"}, 0, 10)
	require.NoError(t, err)
	assert.Equal(t, int64(2), total)
	require.Len(t, got, 2)
	assert.Equal(t, "Go Advanced", got[0].Title)
	assert.Equal(t, "Python Basics", got[1].Title)
}

func TestGetPublishedBlogTags(t *testing.T) {
	truncateTables(t)

	now := int64(1000)
	articles := []*BlogArticle{
		{Id: 1, AuthorId: 1, Title: "A", Summary: "", Content: "", Tags: "go,programming", Status: BlogArticleStatusPublished, PublishedAt: now},
		{Id: 2, AuthorId: 1, Title: "B", Summary: "", Content: "", Tags: "go,programming", Status: BlogArticleStatusPublished, PublishedAt: now + 1},
		{Id: 3, AuthorId: 1, Title: "C", Summary: "", Content: "", Tags: "python", Status: BlogArticleStatusPublished, PublishedAt: now + 2},
		{Id: 4, AuthorId: 1, Title: "D", Summary: "", Content: "", Tags: "secret", Status: BlogArticleStatusDraft, PublishedAt: now + 3},
	}
	for _, a := range articles {
		require.NoError(t, DB.Create(a).Error)
	}

	tags, err := GetPublishedBlogTags(10)
	require.NoError(t, err)
	require.Len(t, tags, 3)
	assert.Equal(t, "go", tags[0].Tag)
	assert.Equal(t, int64(2), tags[0].Count)
	assert.Equal(t, "programming", tags[1].Tag)
	assert.Equal(t, int64(2), tags[1].Count)
	assert.Equal(t, "python", tags[2].Tag)
	assert.Equal(t, int64(1), tags[2].Count)
}
