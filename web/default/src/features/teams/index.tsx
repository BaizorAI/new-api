/*
Copyright (C) 2023-2026 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program. If not, see <https://www.gnu.org/licenses/>.

For commercial licensing, please contact support@quantumnous.com
*/

import {
  ArrowRightLeft,
  Copy,
  Edit,
  Eye,
  KeyRound,
  Link,
  MoreHorizontal,
  Plus,
  Power,
  PowerOff,
  RefreshCw,
  Trash2,
  UserPlus,
  WalletCards,
} from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { SectionPageLayout } from '@/components/layout'
import { MultiSelect } from '@/components/multi-select'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Textarea } from '@/components/ui/textarea'
import {
  ApiKeyGroupCombobox,
  type ApiKeyGroupOption,
} from '@/features/keys/components/api-key-group-combobox'
import { CCSwitchDialog } from '@/features/keys/components/dialogs/cc-switch-dialog'
import { getUserGroups, getUserModels } from '@/lib/api'
import { copyToClipboard } from '@/lib/copy-to-clipboard'
import { getCurrencyDisplay, getCurrencyLabel } from '@/lib/currency'
import {
  formatQuota,
  parseQuotaFromDollars,
  quotaUnitsToDollars,
} from '@/lib/format'

import {
  addTeamMember,
  createTeam,
  createTeamToken,
  deleteTeamToken,
  getTeam,
  listTeams,
  removeTeamMember,
  revealTeamTokenKey,
  transferQuotaToTeam,
  updateTeamToken,
  updateTeamTokenStatus,
} from './api'
import type { Team, TeamDetail, TeamRole, TeamToken } from './types'

const ROLE_OPTIONS: TeamRole[] = ['admin', 'member', 'viewer']

function getServerAddress(): string {
  try {
    const raw = localStorage.getItem('status')
    if (raw) {
      const status = JSON.parse(raw)
      if (status.server_address) return status.server_address as string
    }
  } catch {
    /* empty */
  }
  return window.location.origin
}

function normalizeTokenKey(key: string): string {
  return key.startsWith('sk-') ? key : `sk-${key}`
}

function encodeConnectionString(key: string, url: string): string {
  return JSON.stringify({
    _type: 'newapi_channel_conn',
    key: normalizeTokenKey(key),
    url,
  })
}

function roleLabel(role: TeamRole, t: (key: string) => string) {
  switch (role) {
    case 'owner':
      return t('Owner')
    case 'admin':
      return t('Admin')
    case 'viewer':
      return t('Viewer')
    default:
      return t('Member')
  }
}

export function Teams() {
  const { t } = useTranslation()
  const [teams, setTeams] = useState<Team[]>([])
  const [selectedTeamId, setSelectedTeamId] = useState<number | null>(null)
  const [detail, setDetail] = useState<TeamDetail | null>(null)
  const [loading, setLoading] = useState(false)
  const [createTeamOpen, setCreateTeamOpen] = useState(false)
  const [createTokenOpen, setCreateTokenOpen] = useState(false)
  const [editingToken, setEditingToken] = useState<TeamToken | null>(null)
  const [revealedKey, setRevealedKey] = useState('')
  const [ccSwitchKey, setCcSwitchKey] = useState('')
  const [teamName, setTeamName] = useState('')
  const [memberIdentifier, setMemberIdentifier] = useState('')
  const [memberRole, setMemberRole] = useState<TeamRole>('member')
  const [quota, setQuota] = useState('')
  const [models, setModels] = useState<string[]>([])
  const [groups, setGroups] = useState<ApiKeyGroupOption[]>([])
  const [tokenName, setTokenName] = useState('')
  const [tokenQuota, setTokenQuota] = useState('0')
  const [tokenUnlimited, setTokenUnlimited] = useState(true)
  const [tokenModelLimits, setTokenModelLimits] = useState<string[]>([])
  const [tokenAllowIps, setTokenAllowIps] = useState('')
  const [tokenGroup, setTokenGroup] = useState('')
  const [tokenCrossGroupRetry, setTokenCrossGroupRetry] = useState(false)

  const selectedTeam =
    detail?.team ?? teams.find((team) => team.id === selectedTeamId)
  const canManage =
    selectedTeam?.role === 'owner' || selectedTeam?.role === 'admin'
  const { meta: currencyMeta } = getCurrencyDisplay()
  const currencyLabel = getCurrencyLabel()
  const tokensOnly = currencyMeta.kind === 'tokens'
  const quotaLabel = t('Quota ({{currency}})', { currency: currencyLabel })
  const quotaPlaceholder = tokensOnly
    ? t('Enter quota in tokens')
    : t('Enter quota in {{currency}}', { currency: currencyLabel })

  const loadTeams = useCallback(async () => {
    setLoading(true)
    try {
      const res = await listTeams()
      if (res.success && res.data) {
        setTeams(res.data)
        setSelectedTeamId((current) => current ?? res.data?.[0]?.id ?? null)
      }
    } finally {
      setLoading(false)
    }
  }, [])

  const loadDetail = useCallback(async (teamId: number) => {
    const res = await getTeam(teamId)
    if (res.success && res.data) {
      setDetail(res.data)
    }
  }, [])

  useEffect(() => {
    loadTeams()
  }, [loadTeams])

  useEffect(() => {
    async function loadTokenOptions() {
      const [modelRes, groupRes] = await Promise.all([
        getUserModels(),
        getUserGroups(),
      ])
      if (modelRes.success && modelRes.data) {
        setModels(modelRes.data)
      }
      if (groupRes.success && groupRes.data) {
        const groupOptions = Object.entries(groupRes.data).map(
          ([value, item]) => ({
            value,
            label: value,
            desc: item.desc,
            ratio: item.ratio,
          })
        )
        setGroups([{ value: '', label: t('User group') }, ...groupOptions])
      }
    }
    loadTokenOptions()
  }, [t])

  useEffect(() => {
    if (selectedTeamId) {
      loadDetail(selectedTeamId)
    } else {
      setDetail(null)
    }
  }, [loadDetail, selectedTeamId])

  const stats = useMemo(
    () => [
      { label: t('Team Quota'), value: formatQuota(selectedTeam?.quota ?? 0) },
      {
        label: t('Used Quota'),
        value: formatQuota(selectedTeam?.used_quota ?? 0),
      },
      { label: t('Requests'), value: String(selectedTeam?.request_count ?? 0) },
    ],
    [selectedTeam, t]
  )

  function resetTokenForm() {
    setEditingToken(null)
    setTokenName('')
    setTokenQuota('0')
    setTokenUnlimited(true)
    setTokenModelLimits([])
    setTokenAllowIps('')
    setTokenGroup('')
    setTokenCrossGroupRetry(false)
  }

  function openCreateTokenDialog() {
    resetTokenForm()
    setCreateTokenOpen(true)
  }

  function openEditTokenDialog(token: TeamToken) {
    setEditingToken(token)
    setTokenName(token.name)
    setTokenQuota(String(quotaUnitsToDollars(token.remain_quota ?? 0)))
    setTokenUnlimited(token.unlimited_quota)
    setTokenModelLimits(
      token.model_limits_enabled && token.model_limits
        ? token.model_limits.split(',').filter(Boolean)
        : []
    )
    setTokenAllowIps(token.allow_ips || '')
    setTokenGroup(token.group || '')
    setTokenCrossGroupRetry(!!token.cross_group_retry)
    setCreateTokenOpen(true)
  }

  function buildTokenPayload() {
    return {
      name: tokenName.trim(),
      remain_quota: Math.max(0, parseQuotaFromDollars(Number(tokenQuota) || 0)),
      unlimited_quota: tokenUnlimited,
      expired_time: editingToken?.expired_time ?? -1,
      model_limits_enabled: tokenModelLimits.length > 0,
      model_limits: tokenModelLimits.join(','),
      allow_ips: tokenAllowIps,
      group: tokenGroup,
      cross_group_retry: tokenGroup === 'auto' ? tokenCrossGroupRetry : false,
      status: editingToken?.status,
    }
  }

  async function handleCreateTeam() {
    const name = teamName.trim()
    if (!name) return
    const res = await createTeam(name)
    if (res.success && res.data) {
      toast.success(t('Team created'))
      setCreateTeamOpen(false)
      setTeamName('')
      await loadTeams()
      setSelectedTeamId(res.data.id)
    }
  }

  async function handleAddMember() {
    if (!selectedTeamId || !memberIdentifier.trim()) return
    const res = await addTeamMember(
      selectedTeamId,
      memberIdentifier,
      memberRole
    )
    if (res.success) {
      toast.success(t('Member added'))
      setMemberIdentifier('')
      await loadDetail(selectedTeamId)
    }
  }

  async function handleTransferQuota() {
    if (!selectedTeamId) return
    const parsed = Number(quota)
    if (!Number.isFinite(parsed) || parsed <= 0) return
    const quotaUnits = parseQuotaFromDollars(parsed)
    if (quotaUnits <= 0) return
    const res = await transferQuotaToTeam(selectedTeamId, quotaUnits)
    if (res.success) {
      toast.success(t('Quota transferred'))
      setQuota('')
      await loadDetail(selectedTeamId)
    }
  }

  async function handleCreateToken() {
    if (!selectedTeamId) return
    const payload = buildTokenPayload()
    const res = editingToken
      ? await updateTeamToken(selectedTeamId, editingToken.id, payload)
      : await createTeamToken(selectedTeamId, payload)
    if (res.success) {
      toast.success(
        editingToken ? t('Team API key updated') : t('Team API key created')
      )
      setCreateTokenOpen(false)
      resetTokenForm()
      await loadDetail(selectedTeamId)
    }
  }

  async function handleRevealToken(token: TeamToken) {
    if (!selectedTeamId) return
    const res = await revealTeamTokenKey(selectedTeamId, token.id)
    if (res.success && res.data?.key) {
      setRevealedKey(normalizeTokenKey(res.data.key))
    }
  }

  async function getTeamTokenKey(token: TeamToken) {
    if (!selectedTeamId) return null
    const res = await revealTeamTokenKey(selectedTeamId, token.id)
    if (res.success && res.data?.key) {
      return normalizeTokenKey(res.data.key)
    }
    toast.error(res.message || t('An unexpected error occurred'))
    return null
  }

  async function handleCopyTokenKey(token: TeamToken) {
    const realKey = await getTeamTokenKey(token)
    if (!realKey) return
    const ok = await copyToClipboard(realKey)
    if (ok) toast.success(t('Copied'))
  }

  async function handleCopyConnectionInfo(token: TeamToken) {
    const realKey = await getTeamTokenKey(token)
    if (!realKey) return
    const ok = await copyToClipboard(
      encodeConnectionString(realKey, getServerAddress())
    )
    if (ok) toast.success(t('Copied'))
  }

  async function handleOpenCCSwitch(token: TeamToken) {
    const realKey = await getTeamTokenKey(token)
    if (!realKey) return
    setCcSwitchKey(realKey)
  }

  async function handleToggleTokenStatus(token: TeamToken) {
    if (!selectedTeamId) return
    const nextStatus = token.status === 1 ? 2 : 1
    const res = await updateTeamTokenStatus(
      selectedTeamId,
      token.id,
      nextStatus
    )
    if (res.success) {
      toast.success(nextStatus === 1 ? t('Enabled') : t('Disabled'))
      await loadDetail(selectedTeamId)
    }
  }

  async function handleDeleteToken(token: TeamToken) {
    if (!selectedTeamId) return
    const res = await deleteTeamToken(selectedTeamId, token.id)
    if (res.success) {
      toast.success(t('Deleted'))
      await loadDetail(selectedTeamId)
    }
  }

  async function handleRemoveMember(userId: number) {
    if (!selectedTeamId) return
    const res = await removeTeamMember(selectedTeamId, userId)
    if (res.success) {
      toast.success(t('Member removed'))
      await loadDetail(selectedTeamId)
    }
  }

  return (
    <>
      <SectionPageLayout fixedContent>
        <SectionPageLayout.Title>{t('Teams')}</SectionPageLayout.Title>
        <SectionPageLayout.Actions>
          <div className='flex items-center gap-2'>
            <Button
              variant='outline'
              size='sm'
              onClick={loadTeams}
              disabled={loading}
            >
              <RefreshCw className='size-4' />
              {t('Refresh')}
            </Button>
            <Button size='sm' onClick={() => setCreateTeamOpen(true)}>
              <Plus className='size-4' />
              {t('Create Team')}
            </Button>
          </div>
        </SectionPageLayout.Actions>
        <SectionPageLayout.Content>
          <div className='grid min-h-0 gap-4 lg:grid-cols-[260px_minmax(0,1fr)]'>
            <div className='min-h-0 space-y-2 overflow-auto'>
              {teams.length === 0 ? (
                <Card>
                  <CardHeader>
                    <CardTitle className='text-base'>
                      {t('No teams yet')}
                    </CardTitle>
                    <CardDescription>
                      {t(
                        'Create a team to share quota, members, and team API keys.'
                      )}
                    </CardDescription>
                  </CardHeader>
                </Card>
              ) : (
                teams.map((team) => (
                  <button
                    key={team.id}
                    type='button'
                    onClick={() => setSelectedTeamId(team.id)}
                    className={`border-border bg-card text-card-foreground hover:bg-muted/60 flex w-full items-center justify-between rounded-lg border p-3 text-left text-sm transition-colors ${
                      selectedTeamId === team.id ? 'ring-ring ring-2' : ''
                    }`}
                  >
                    <span className='min-w-0'>
                      <span className='block truncate font-medium'>
                        {team.name}
                      </span>
                      <span className='text-muted-foreground block truncate text-xs'>
                        {formatQuota(team.quota)}
                      </span>
                    </span>
                    <Badge variant='outline'>{roleLabel(team.role, t)}</Badge>
                  </button>
                ))
              )}
            </div>

            <div className='min-h-0 space-y-4 overflow-auto'>
              {selectedTeam ? (
                <>
                  <div className='grid gap-3 sm:grid-cols-3'>
                    {stats.map((item) => (
                      <Card key={item.label}>
                        <CardHeader className='pb-2'>
                          <CardDescription>{item.label}</CardDescription>
                          <CardTitle className='text-2xl'>
                            {item.value}
                          </CardTitle>
                        </CardHeader>
                      </Card>
                    ))}
                  </div>

                  <div className='grid gap-4 xl:grid-cols-2'>
                    <Card>
                      <CardHeader>
                        <CardTitle>{t('Members')}</CardTitle>
                        <CardDescription>
                          {t(
                            'Admins can add members and create team API keys.'
                          )}
                        </CardDescription>
                      </CardHeader>
                      <CardContent className='space-y-4'>
                        {canManage ? (
                          <div className='grid gap-2 sm:grid-cols-[minmax(0,1fr)_128px_auto]'>
                            <Input
                              value={memberIdentifier}
                              onChange={(event) =>
                                setMemberIdentifier(event.target.value)
                              }
                              placeholder={t('Username or email')}
                            />
                            <Select
                              items={ROLE_OPTIONS.map((role) => ({
                                value: role,
                                label: roleLabel(role, t),
                              }))}
                              value={memberRole}
                              onValueChange={(value) =>
                                value && setMemberRole(value as TeamRole)
                              }
                            >
                              <SelectTrigger className='w-full'>
                                <SelectValue>
                                  {roleLabel(memberRole, t)}
                                </SelectValue>
                              </SelectTrigger>
                              <SelectContent alignItemWithTrigger={false}>
                                <SelectGroup>
                                  {ROLE_OPTIONS.map((role) => (
                                    <SelectItem key={role} value={role}>
                                      {roleLabel(role, t)}
                                    </SelectItem>
                                  ))}
                                </SelectGroup>
                              </SelectContent>
                            </Select>
                            <Button onClick={handleAddMember}>
                              <UserPlus className='size-4' />
                              {t('Add')}
                            </Button>
                          </div>
                        ) : null}
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>{t('User')}</TableHead>
                              <TableHead>{t('Role')}</TableHead>
                              <TableHead className='w-16' />
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {detail?.members.map((member) => (
                              <TableRow key={member.id}>
                                <TableCell>
                                  <div className='font-medium'>
                                    {member.display_name || member.username}
                                  </div>
                                  <div className='text-muted-foreground text-xs'>
                                    {member.email || member.username}
                                  </div>
                                </TableCell>
                                <TableCell>
                                  <Badge variant='secondary'>
                                    {roleLabel(member.role, t)}
                                  </Badge>
                                </TableCell>
                                <TableCell>
                                  {canManage && member.role !== 'owner' ? (
                                    <Button
                                      variant='ghost'
                                      size='icon-sm'
                                      onClick={() =>
                                        handleRemoveMember(member.user_id)
                                      }
                                    >
                                      <Trash2 className='size-4' />
                                      <span className='sr-only'>
                                        {t('Remove')}
                                      </span>
                                    </Button>
                                  ) : null}
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader>
                        <CardTitle>{t('Team Quota')}</CardTitle>
                        <CardDescription>
                          {t(
                            'Transfer personal quota into the team wallet for team API keys.'
                          )}
                        </CardDescription>
                      </CardHeader>
                      <CardContent className='space-y-3'>
                        <div className='grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto]'>
                          <Input
                            id='team-quota-transfer'
                            value={quota}
                            type='number'
                            min={tokensOnly ? '1' : '0.01'}
                            step={tokensOnly ? '1' : '0.01'}
                            onChange={(event) => setQuota(event.target.value)}
                            placeholder={quotaPlaceholder}
                            disabled={!canManage}
                            aria-label={quotaLabel}
                          />
                          <Button
                            onClick={handleTransferQuota}
                            disabled={!canManage}
                          >
                            <WalletCards className='size-4' />
                            {t('Transfer')}
                          </Button>
                        </div>
                        <p className='text-muted-foreground text-xs'>
                          {tokensOnly
                            ? t('Enter the quota amount in tokens')
                            : t('Enter the quota amount in {{currency}}', {
                                currency: currencyLabel,
                              })}
                        </p>
                      </CardContent>
                    </Card>
                  </div>

                  <Card>
                    <CardHeader className='flex flex-row items-center justify-between gap-3'>
                      <div>
                        <CardTitle>{t('Team API Keys')}</CardTitle>
                        <CardDescription>
                          {t(
                            'Requests made with team API keys deduct team quota.'
                          )}
                        </CardDescription>
                      </div>
                      <Button
                        size='sm'
                        onClick={openCreateTokenDialog}
                        disabled={!canManage}
                      >
                        <KeyRound className='size-4' />
                        {t('Create Key')}
                      </Button>
                    </CardHeader>
                    <CardContent>
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>{t('Name')}</TableHead>
                            <TableHead>{t('Key')}</TableHead>
                            <TableHead>{t('Group')}</TableHead>
                            <TableHead>{t('Model Limits')}</TableHead>
                            <TableHead>{t('IP Limits')}</TableHead>
                            <TableHead>{t('Used Quota')}</TableHead>
                            <TableHead>{t('Remaining Quota')}</TableHead>
                            <TableHead className='w-24'>
                              {t('Actions')}
                            </TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {detail?.tokens.map((token) => (
                            <TableRow key={token.id}>
                              <TableCell>{token.name}</TableCell>
                              <TableCell className='font-mono text-xs'>
                                {token.key}
                              </TableCell>
                              <TableCell>
                                <Badge variant='outline'>
                                  {token.group || t('User group')}
                                </Badge>
                              </TableCell>
                              <TableCell>
                                {token.model_limits_enabled &&
                                token.model_limits ? (
                                  <span className='text-muted-foreground text-xs'>
                                    {token.model_limits.split(',').length}{' '}
                                    {t('models')}
                                  </span>
                                ) : (
                                  <span className='text-muted-foreground text-xs'>
                                    {t('All models')}
                                  </span>
                                )}
                              </TableCell>
                              <TableCell>
                                {token.allow_ips ? (
                                  <span className='text-muted-foreground text-xs'>
                                    {
                                      token.allow_ips
                                        .split('\n')
                                        .filter(Boolean).length
                                    }{' '}
                                    {t('rules')}
                                  </span>
                                ) : (
                                  <span className='text-muted-foreground text-xs'>
                                    {t('No restriction')}
                                  </span>
                                )}
                              </TableCell>
                              <TableCell>
                                {formatQuota(token.used_quota)}
                              </TableCell>
                              <TableCell>
                                {token.unlimited_quota
                                  ? t('Unlimited')
                                  : formatQuota(token.remain_quota)}
                              </TableCell>
                              <TableCell>
                                <div className='flex items-center gap-1'>
                                  {canManage ? (
                                    <Button
                                      variant='ghost'
                                      size='icon-sm'
                                      onClick={() =>
                                        handleToggleTokenStatus(token)
                                      }
                                    >
                                      {token.status === 1 ? (
                                        <PowerOff className='size-4' />
                                      ) : (
                                        <Power className='size-4' />
                                      )}
                                      <span className='sr-only'>
                                        {token.status === 1
                                          ? t('Disable')
                                          : t('Enable')}
                                      </span>
                                    </Button>
                                  ) : null}
                                  <DropdownMenu modal={false}>
                                    <DropdownMenuTrigger
                                      render={
                                        <Button
                                          variant='ghost'
                                          size='icon-sm'
                                          aria-label={t('Open menu')}
                                        />
                                      }
                                    >
                                      <MoreHorizontal className='size-4' />
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent
                                      align='end'
                                      className='w-[200px]'
                                    >
                                      <DropdownMenuItem
                                        onClick={() =>
                                          handleCopyTokenKey(token)
                                        }
                                      >
                                        {t('Copy Key')}
                                        <DropdownMenuShortcut>
                                          <Copy size={16} />
                                        </DropdownMenuShortcut>
                                      </DropdownMenuItem>
                                      <DropdownMenuItem
                                        onClick={() =>
                                          handleCopyConnectionInfo(token)
                                        }
                                      >
                                        {t('Copy Connection Info')}
                                        <DropdownMenuShortcut>
                                          <Link size={16} />
                                        </DropdownMenuShortcut>
                                      </DropdownMenuItem>
                                      <DropdownMenuItem
                                        onClick={() => handleRevealToken(token)}
                                      >
                                        {t('Reveal')}
                                        <DropdownMenuShortcut>
                                          <Eye size={16} />
                                        </DropdownMenuShortcut>
                                      </DropdownMenuItem>
                                      <DropdownMenuSeparator />
                                      <DropdownMenuItem
                                        onClick={() =>
                                          handleOpenCCSwitch(token)
                                        }
                                      >
                                        {t('CC Switch')}
                                        <DropdownMenuShortcut>
                                          <ArrowRightLeft size={16} />
                                        </DropdownMenuShortcut>
                                      </DropdownMenuItem>
                                      {canManage ? (
                                        <>
                                          <DropdownMenuItem
                                            onClick={() =>
                                              openEditTokenDialog(token)
                                            }
                                          >
                                            {t('Edit')}
                                            <DropdownMenuShortcut>
                                              <Edit size={16} />
                                            </DropdownMenuShortcut>
                                          </DropdownMenuItem>
                                          <DropdownMenuSeparator />
                                          <DropdownMenuItem
                                            onClick={() =>
                                              handleDeleteToken(token)
                                            }
                                            className='text-destructive focus:text-destructive'
                                          >
                                            {t('Delete')}
                                            <DropdownMenuShortcut>
                                              <Trash2 size={16} />
                                            </DropdownMenuShortcut>
                                          </DropdownMenuItem>
                                        </>
                                      ) : null}
                                    </DropdownMenuContent>
                                  </DropdownMenu>
                                </div>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </CardContent>
                  </Card>
                </>
              ) : null}
            </div>
          </div>
        </SectionPageLayout.Content>
      </SectionPageLayout>

      <Dialog open={createTeamOpen} onOpenChange={setCreateTeamOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('Create Team')}</DialogTitle>
            <DialogDescription>
              {t('The current user becomes the team owner.')}
            </DialogDescription>
          </DialogHeader>
          <div className='space-y-2'>
            <Label htmlFor='team-name'>{t('Team Name')}</Label>
            <Input
              id='team-name'
              value={teamName}
              onChange={(event) => setTeamName(event.target.value)}
              placeholder={t('Team Name')}
            />
          </div>
          <DialogFooter>
            <Button variant='outline' onClick={() => setCreateTeamOpen(false)}>
              {t('Cancel')}
            </Button>
            <Button onClick={handleCreateTeam}>{t('Create')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={createTokenOpen}
        onOpenChange={(open) => {
          setCreateTokenOpen(open)
          if (!open) resetTokenForm()
        }}
      >
        <DialogContent className='sm:max-w-2xl'>
          <DialogHeader>
            <DialogTitle>
              {editingToken ? t('Edit Team API Key') : t('Create Team API Key')}
            </DialogTitle>
            <DialogDescription>
              {t('This key belongs to the team and consumes team quota.')}
            </DialogDescription>
          </DialogHeader>
          <div className='max-h-[70vh] space-y-4 overflow-y-auto pr-1'>
            <div className='grid gap-4 sm:grid-cols-2'>
              <div className='space-y-2'>
                <Label htmlFor='team-token-name'>{t('Name')}</Label>
                <Input
                  id='team-token-name'
                  value={tokenName}
                  onChange={(event) => setTokenName(event.target.value)}
                  placeholder={t('Name')}
                />
              </div>
              <div className='space-y-2'>
                <Label>{t('Group')}</Label>
                <ApiKeyGroupCombobox
                  options={groups}
                  value={tokenGroup}
                  onValueChange={setTokenGroup}
                  placeholder={t('Select a group')}
                />
              </div>
            </div>
            {tokenGroup === 'auto' ? (
              <div className='flex items-center justify-between gap-3 rounded-lg border p-3'>
                <div>
                  <Label htmlFor='team-token-cross-group'>
                    {t('Cross-group retry')}
                  </Label>
                  <p className='text-muted-foreground text-xs'>
                    {t(
                      'When enabled, if channels in the current group fail, it will try channels in the next group in order.'
                    )}
                  </p>
                </div>
                <Switch
                  id='team-token-cross-group'
                  checked={tokenCrossGroupRetry}
                  onCheckedChange={setTokenCrossGroupRetry}
                />
              </div>
            ) : null}
            <div className='flex items-center justify-between gap-3 rounded-lg border p-3'>
              <div>
                <Label htmlFor='team-token-unlimited'>
                  {t('Unlimited Quota')}
                </Label>
                <p className='text-muted-foreground text-xs'>
                  {t('Enable unlimited quota for this API key')}
                </p>
              </div>
              <Switch
                id='team-token-unlimited'
                checked={tokenUnlimited}
                onCheckedChange={setTokenUnlimited}
              />
            </div>
            {!tokenUnlimited ? (
              <div className='space-y-2'>
                <Label htmlFor='team-token-quota'>
                  {t('Remaining Quota ({{currency}})', {
                    currency: currencyLabel,
                  })}
                </Label>
                <Input
                  id='team-token-quota'
                  type='number'
                  min='0'
                  step={tokensOnly ? 1 : 0.01}
                  value={tokenQuota}
                  onChange={(event) => setTokenQuota(event.target.value)}
                  placeholder={quotaPlaceholder}
                />
                <p className='text-muted-foreground text-xs'>
                  {tokensOnly
                    ? t('Enter the quota amount in tokens')
                    : t('Enter the quota amount in {{currency}}', {
                        currency: currencyLabel,
                      })}
                </p>
              </div>
            ) : null}
            <div className='space-y-2'>
              <Label>{t('Model Limits')}</Label>
              <MultiSelect
                options={models.map((model) => ({
                  label: model,
                  value: model,
                }))}
                selected={tokenModelLimits}
                onChange={setTokenModelLimits}
                placeholder={t('Select models (empty for allow all)')}
                allowCreate
                maxVisibleChips={6}
              />
              <p className='text-muted-foreground text-xs'>
                {t('Limit which models can be used with this key')}
              </p>
            </div>
            <div className='space-y-2'>
              <Label htmlFor='team-token-ips'>
                {t('IP Whitelist (supports CIDR)')}
              </Label>
              <Textarea
                id='team-token-ips'
                value={tokenAllowIps}
                onChange={(event) => setTokenAllowIps(event.target.value)}
                placeholder={t('One IP per line (empty for no restriction)')}
                rows={3}
              />
              <p className='text-muted-foreground text-xs'>
                {t(
                  'Do not over-trust this feature. IP may be spoofed. Please use with nginx, CDN and other gateways.'
                )}
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant='outline'
              onClick={() => {
                setCreateTokenOpen(false)
                resetTokenForm()
              }}
            >
              {t('Cancel')}
            </Button>
            <Button onClick={handleCreateToken}>
              {editingToken ? t('Save') : t('Create')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={revealedKey !== ''}
        onOpenChange={(open) => !open && setRevealedKey('')}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('API Key')}</DialogTitle>
            <DialogDescription>
              {t('Store this key securely.')}
            </DialogDescription>
          </DialogHeader>
          <Input readOnly value={revealedKey} className='font-mono text-xs' />
          <DialogFooter>
            <Button onClick={() => navigator.clipboard.writeText(revealedKey)}>
              {t('Copy')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <CCSwitchDialog
        open={ccSwitchKey !== ''}
        onOpenChange={(open) => !open && setCcSwitchKey('')}
        tokenKey={ccSwitchKey}
      />
    </>
  )
}
