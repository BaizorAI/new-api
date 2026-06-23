package service

import (
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestTeamFundingSourceIsDistinctFromPersonalWallet(t *testing.T) {
	funding := &TeamFunding{teamId: 7}

	assert.Equal(t, BillingSourceTeamWallet, funding.Source())
	assert.NotEqual(t, BillingSourceWallet, funding.Source())
}
