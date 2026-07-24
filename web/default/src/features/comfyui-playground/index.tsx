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
import { useState, useCallback, useEffect, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { Undo2, Redo2, Download, Upload, Copy, RotateCcw } from 'lucide-react'

import { generateComfyuiVideo, enhancePrompt, fetchWorkflow, pollQueueStatus } from './api'
import { WorkflowCanvas } from './workflow-canvas'
import { WorkflowSelector } from './workflow-selector'
import { SidebarPanel } from './sidebar-panel'
import { PresetSelector } from './preset-selector'
import { WorkflowImportDialog } from './workflow-import-dialog'
import { ShortcutsDialog } from './shortcuts-dialog'
import { RestoreDraftDialog } from './restore-draft-dialog'
import { hasAutoSave, clearAutoSave, loadAutoSave, scheduleAutoSave } from './auto-save-manager'
import { loadPresets, savePreset, deletePreset, renamePreset } from './preset-manager'
import { saveHistoryEntry, loadHistory } from './history-manager'
import {
  detectCommonParams,
  readCommonParam,
  writeCommonParam,
  paramNodeId,
} from './workflow-parser'
import type { CommonParams } from './workflow-parser'
import type { ComfyuiWorkflow, WorkflowDetail, WorkflowPreset, GenerationEntry } from './types'

const MAX_HISTORY = 50

function parseVideoUrls(content: string): {
  promptId: string
  videos: { name: string; url: string }[]
} {
  const promptId = content.match(/Prompt ID:\s*(\S+)/)?.[1] ?? ''
  const videoLines = content.matchAll(/^- (.+\.mp4)\s+(.+)$/gm)
  const videos = Array.from(videoLines, ([_, name, url]) => ({
    name: name.trim(),
    url: url.trim(),
  }))
  return { promptId, videos }
}

const DEFAULT_PARAMS = { width: 768, height: 512, frames: 33, steps: 30, fps: 24 }

export function ComfyuiPlayground() {
  const { t } = useTranslation()

  // ── Workflow state ──
  const [workflowDetail, setWorkflowDetail] = useState<WorkflowDetail | null>(null)
  const [workflow, setWorkflow] = useState<ComfyuiWorkflow | null>(null)
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null)
  const [wfLoading, setWfLoading] = useState(false)

  // ── Undo / redo ──
  const [undoStack, setUndoStack] = useState<ComfyuiWorkflow[]>([])
  const [redoStack, setRedoStack] = useState<ComfyuiWorkflow[]>([])

  // ── Presets ──
  const [presets, setPresets] = useState<WorkflowPreset[]>(() => loadPresets())

  // ── History ──
  const [history, setHistory] = useState<GenerationEntry[]>(() => loadHistory())

  // Derived common params
  const commonParams = useMemo<CommonParams>(
    () => detectCommonParams(workflowDetail?.adjustable_params ?? []),
    [workflowDetail],
  )

  // ── Sidebar state ──
  const [prompt, setPrompt] = useState('')
  const [enhancedPrompt, setEnhancedPrompt] = useState('')
  const [enhancing, setEnhancing] = useState(false)
  const [width, setWidth] = useState(DEFAULT_PARAMS.width)
  const [height, setHeight] = useState(DEFAULT_PARAMS.height)
  const [frames, setFrames] = useState(DEFAULT_PARAMS.frames)
  const [fps, setFps] = useState(DEFAULT_PARAMS.fps)
  const [steps, setSteps] = useState(DEFAULT_PARAMS.steps)
  const [seed, setSeed] = useState(-1)
  const [cfg, setCfg] = useState(7)

  // ── Generation state ──
  const [loading, setLoading] = useState(false)
  const [queuePosition, setQueuePosition] = useState(-1)
  const [currentPromptId, setCurrentPromptId] = useState<string | null>(null)
  const [result, setResult] = useState<{
    promptId: string
    videos: { name: string; url: string }[]
  } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [importOpen, setImportOpen] = useState(false)
  const [shortcutsOpen, setShortcutsOpen] = useState(false)
  const [draftDialogOpen, setDraftDialogOpen] = useState(false)

  const effectivePrompt = enhancedPrompt || prompt

  // Sync sidebar values from a restored workflow
  const syncSidebar = useCallback(
    (wf: ComfyuiWorkflow) => {
      const cp = commonParams
      const p = readCommonParam(wf, cp.promptNodeId, cp.promptField)
      if (typeof p === 'string') {
        setPrompt(p)
        setEnhancedPrompt('')
      }
      const w = readCommonParam(wf, cp.widthNodeId, cp.widthField)
      if (typeof w === 'number' && !Number.isNaN(w)) setWidth(w)
      const h = readCommonParam(wf, cp.heightNodeId, cp.heightField)
      if (typeof h === 'number' && !Number.isNaN(h)) setHeight(h)
      const f = readCommonParam(wf, cp.framesNodeId, cp.framesField)
      if (typeof f === 'number' && !Number.isNaN(f)) setFrames(f)
      const fp = readCommonParam(wf, cp.fpsNodeId, cp.fpsField)
      if (typeof fp === 'number' && !Number.isNaN(fp)) setFps(fp)
      const s = readCommonParam(wf, cp.stepsNodeId, cp.stepsField)
      if (typeof s === 'number' && !Number.isNaN(s)) setSteps(s)
      const sd = readCommonParam(wf, cp.seedNodeId, cp.seedField)
      if (typeof sd === 'number' && !Number.isNaN(sd)) setSeed(sd)
      const c = readCommonParam(wf, cp.cfgNodeId, cp.cfgField)
      if (typeof c === 'number' && !Number.isNaN(c)) setCfg(c)
    },
    [commonParams],
  )

  // Push workflow snapshot to undo stack before overwriting
  const pushWorkflow = useCallback(
    (wf: ComfyuiWorkflow) => {
      setWorkflow((prev) => {
        if (prev) setUndoStack((s) => [...s.slice(-(MAX_HISTORY - 1)), prev])
        return wf
      })
      setRedoStack([])
    },
    [],
  )

  // ── Undo / Redo ──
  const handleUndo = useCallback(() => {
    if (undoStack.length === 0) return
    const prev = undoStack[undoStack.length - 1]
    setWorkflow((current) => {
      if (current) setRedoStack((s) => [...s, current])
      return prev
    })
    setUndoStack((s) => s.slice(0, -1))
    syncSidebar(prev)
  }, [undoStack, syncSidebar])

  const handleRedo = useCallback(() => {
    if (redoStack.length === 0) return
    const next = redoStack[redoStack.length - 1]
    setWorkflow((current) => {
      if (current) setUndoStack((s) => [...s, current])
      return next
    })
    setRedoStack((s) => s.slice(0, -1))
    syncSidebar(next)
  }, [redoStack, syncSidebar])

  // ── Export workflow ──
  const handleExport = useCallback(() => {
    if (!workflow) return
    const json = JSON.stringify(workflow, null, 2)
    const blob = new Blob([json], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${workflowDetail?.name ?? 'workflow'}.json`
    a.click()
    URL.revokeObjectURL(url)
  }, [workflow, workflowDetail])

  // ── Preset handlers ──
  const handleSavePreset = useCallback(
    (name: string) => {
      if (!workflow) return
      const preset: WorkflowPreset = {
        name,
        savedAt: Date.now(),
        workflow,
        workflowName: workflowDetail?.name ?? null,
      }
      savePreset(preset)
      setPresets(loadPresets())
    },
    [workflow, workflowDetail],
  )

  const handleLoadPreset = useCallback(
    (preset: WorkflowPreset) => {
      setWorkflow(preset.workflow)
      setUndoStack([])
      setRedoStack([])
      syncSidebar(preset.workflow)
      // Reconstruct workflowDetail from preset metadata so node inspector works
      if (preset.workflowName) {
        setWorkflowDetail({
          name: preset.workflowName,
          workflow: preset.workflow,
          adjustable_params: workflowDetail?.adjustable_params ?? [],
        })
      }
    },
    [syncSidebar, workflowDetail],
  )

  const handleDeletePreset = useCallback((name: string) => {
    deletePreset(name)
    setPresets(loadPresets())
  }, [])

  const handleRenamePreset = useCallback((oldName: string, newName: string) => {
    renamePreset(oldName, newName)
    setPresets(loadPresets())
  }, [])

  // ── Copy workflow to clipboard ──
  const handleCopy = useCallback(async () => {
    if (!workflow) return
    try {
      await navigator.clipboard.writeText(JSON.stringify(workflow, null, 2))
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // ignored
    }
  }, [workflow])

  // ── Import workflow ──
  const handleImport = useCallback((detail: WorkflowDetail) => {
    setWorkflowDetail(detail)
    setWorkflow(detail.workflow)
    setSelectedNodeId(null)
    setUndoStack([])
    setRedoStack([])

    const cp = detectCommonParams(detail.adjustable_params)
    const p = readCommonParam(detail.workflow, cp.promptNodeId, cp.promptField)
    if (typeof p === 'string') {
      setPrompt(p)
      setEnhancedPrompt('')
    }
    const w = readCommonParam(detail.workflow, cp.widthNodeId, cp.widthField)
    if (typeof w === 'number' && !Number.isNaN(w)) setWidth(w)
    const h = readCommonParam(detail.workflow, cp.heightNodeId, cp.heightField)
    if (typeof h === 'number' && !Number.isNaN(h)) setHeight(h)
    const f = readCommonParam(detail.workflow, cp.framesNodeId, cp.framesField)
    if (typeof f === 'number' && !Number.isNaN(f)) setFrames(f)
    const fp = readCommonParam(detail.workflow, cp.fpsNodeId, cp.fpsField)
    if (typeof fp === 'number' && !Number.isNaN(fp)) setFps(fp)
    const s = readCommonParam(detail.workflow, cp.stepsNodeId, cp.stepsField)
    if (typeof s === 'number' && !Number.isNaN(s)) setSteps(s)
    const sd = readCommonParam(detail.workflow, cp.seedNodeId, cp.seedField)
    if (typeof sd === 'number' && !Number.isNaN(sd)) setSeed(sd)
    const c = readCommonParam(detail.workflow, cp.cfgNodeId, cp.cfgField)
    if (typeof c === 'number' && !Number.isNaN(c)) setCfg(c)
  }, [])

  // ── Reset to server original ──
  const handleReset = useCallback(() => {
    if (!window.confirm(t('Discard changes and reload from server?'))) return
    setWorkflow(workflowDetail?.workflow ?? null)
    setUndoStack([])
    setRedoStack([])
    if (workflowDetail) syncSidebar(workflowDetail.workflow)
  }, [workflowDetail, syncSidebar, t])

  // ── Keyboard shortcuts ──
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const meta = e.metaKey || e.ctrlKey
      const target = e.target as HTMLElement
      const inInput =
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.tagName === 'SELECT' ||
        target.isContentEditable

      if (meta && e.key === 'z' && !e.shiftKey) {
        e.preventDefault()
        handleUndo()
      } else if (meta && e.key === 'z' && e.shiftKey) {
        e.preventDefault()
        handleRedo()
      } else if (meta && e.key === 's') {
        e.preventDefault()
        handleExport()
      } else if (meta && e.key === 'i') {
        e.preventDefault()
        setImportOpen(true)
      } else if (e.key === '?' && !inInput) {
        setShortcutsOpen(true)
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [handleUndo, handleRedo, handleExport])

  // ── Update workflow via common-param helpers ──
  const updateWorkflowParam = useCallback(
    (nodeId: string | null, field: string | null, value: unknown) => {
      setWorkflow((prev) => {
        if (!prev) return prev
        const updated = writeCommonParam(prev, nodeId, field, value)
        setUndoStack((s) => [...s.slice(-(MAX_HISTORY - 1)), prev])
        setRedoStack([])
        return updated
      })
    },
    [],
  )

  // ── Load workflow ──
  const handleSelectWorkflow = useCallback(
    async (name: string) => {
      setWfLoading(true)
      try {
        const detail = await fetchWorkflow(name)
        setWorkflowDetail(detail)
        setWorkflow(detail.workflow)
        setSelectedNodeId(null)
        setUndoStack([])
        setRedoStack([])

        const cp = detectCommonParams(detail.adjustable_params)
        const p = readCommonParam(detail.workflow, cp.promptNodeId, cp.promptField)
        if (typeof p === 'string') setPrompt(p)
        setEnhancedPrompt('')
        const fp = readCommonParam(detail.workflow, cp.fpsNodeId, cp.fpsField)
        if (typeof fp === 'number' && !Number.isNaN(fp)) setFps(fp)
        const sd = readCommonParam(detail.workflow, cp.seedNodeId, cp.seedField)
        if (typeof sd === 'number' && !Number.isNaN(sd)) setSeed(sd)
        const c = readCommonParam(detail.workflow, cp.cfgNodeId, cp.cfgField)
        if (typeof c === 'number' && !Number.isNaN(c)) setCfg(c)
      } finally {
        setWfLoading(false)
      }
    },
    [],
  )

  // ── Sidebar → workflow → canvas ──
  const handlePromptChange = useCallback(
    (val: string) => {
      setPrompt(val)
      setEnhancedPrompt('')
      updateWorkflowParam(commonParams.promptNodeId, commonParams.promptField, val)
    },
    [commonParams, updateWorkflowParam],
  )

  const handleWidthChange = useCallback(
    (val: number) => {
      setWidth(val)
      updateWorkflowParam(commonParams.widthNodeId, commonParams.widthField, val)
    },
    [commonParams, updateWorkflowParam],
  )

  const handleHeightChange = useCallback(
    (val: number) => {
      setHeight(val)
      updateWorkflowParam(commonParams.heightNodeId, commonParams.heightField, val)
    },
    [commonParams, updateWorkflowParam],
  )

  const handleFramesChange = useCallback(
    (val: number) => {
      setFrames(val)
      updateWorkflowParam(commonParams.framesNodeId, commonParams.framesField, val)
    },
    [commonParams, updateWorkflowParam],
  )

  const handleFpsChange = useCallback(
    (val: number) => {
      setFps(val)
      updateWorkflowParam(commonParams.fpsNodeId, commonParams.fpsField, val)
    },
    [commonParams, updateWorkflowParam],
  )

  const handleStepsChange = useCallback(
    (val: number) => {
      setSteps(val)
      updateWorkflowParam(commonParams.stepsNodeId, commonParams.stepsField, val)
    },
    [commonParams, updateWorkflowParam],
  )

  const handleSeedChange = useCallback(
    (val: number) => {
      setSeed(val)
      updateWorkflowParam(commonParams.seedNodeId, commonParams.seedField, val)
    },
    [commonParams, updateWorkflowParam],
  )

  const handleRandomSeed = useCallback(() => {
    const val = Math.floor(Math.random() * 999999999999) + 1
    setSeed(val)
    updateWorkflowParam(commonParams.seedNodeId, commonParams.seedField, val)
  }, [commonParams, updateWorkflowParam])

  const handleCfgChange = useCallback(
    (val: number) => {
      setCfg(val)
      updateWorkflowParam(commonParams.cfgNodeId, commonParams.cfgField, val)
    },
    [commonParams, updateWorkflowParam],
  )

  const handlePresetSelect = useCallback(
    (w: number, h: number) => {
      setWidth(w)
      setHeight(h)
      setWorkflow((prev) => {
        if (!prev) return prev
        let updated = writeCommonParam(prev, commonParams.widthNodeId, commonParams.widthField, w)
        updated = writeCommonParam(updated, commonParams.heightNodeId, commonParams.heightField, h)
        setUndoStack((s) => [...s.slice(-(MAX_HISTORY - 1)), prev])
        setRedoStack([])
        return updated
      })
    },
    [commonParams],
  )

  const handleHistoryLoad = useCallback(
    (entry: GenerationEntry) => {
      const p = entry.enhancedPrompt || entry.prompt
      setPrompt(entry.prompt)
      setEnhancedPrompt(entry.enhancedPrompt)
      setWidth(entry.width)
      setHeight(entry.height)
      setFrames(entry.frames)
      setFps(entry.fps ?? 24)
      setSteps(entry.steps)
      setSeed(entry.seed)
      setCfg(entry.cfg)
      setWorkflow((prev) => {
        if (!prev) return prev
        let updated = writeCommonParam(prev, commonParams.promptNodeId, commonParams.promptField, p)
        updated = writeCommonParam(updated, commonParams.widthNodeId, commonParams.widthField, entry.width)
        updated = writeCommonParam(updated, commonParams.heightNodeId, commonParams.heightField, entry.height)
        if (commonParams.framesNodeId && commonParams.framesField) {
          updated = writeCommonParam(updated, commonParams.framesNodeId, commonParams.framesField, entry.frames)
        }
        if (commonParams.fpsNodeId && commonParams.fpsField) {
          updated = writeCommonParam(updated, commonParams.fpsNodeId, commonParams.fpsField, entry.fps ?? 24)
        }
        updated = writeCommonParam(updated, commonParams.stepsNodeId, commonParams.stepsField, entry.steps)
        updated = writeCommonParam(updated, commonParams.seedNodeId, commonParams.seedField, entry.seed)
        updated = writeCommonParam(updated, commonParams.cfgNodeId, commonParams.cfgField, entry.cfg)
        setUndoStack((s) => [...s.slice(-(MAX_HISTORY - 1)), prev])
        setRedoStack([])
        return updated
      })
    },
    [commonParams],
  )

  const handleHistoryRefresh = useCallback(() => {
    setHistory(loadHistory())
  }, [])

  // ── Canvas → workflow → sidebar sync ──
  const handleWorkflowChange = useCallback(
    (updated: ComfyuiWorkflow) => {
      pushWorkflow(updated)
      syncSidebar(updated)
    },
    [pushWorkflow, syncSidebar],
  )

  // ── Enhance ──
  const handleEnhance = useCallback(async () => {
    if (!prompt.trim()) return
    setEnhancing(true)
    setEnhancedPrompt('')
    try {
      const enhanced = await enhancePrompt(prompt.trim())
      setEnhancedPrompt(enhanced)
      updateWorkflowParam(commonParams.promptNodeId, commonParams.promptField, enhanced)
    } catch {
      setError(t('Prompt enhancement failed'))
    } finally {
      setEnhancing(false)
    }
  }, [prompt, commonParams, updateWorkflowParam, t])

  // ── Generate ──
  const handleGenerate = useCallback(async () => {
    if (!effectivePrompt.trim()) return
    setLoading(true)
    setError(null)
    setResult(null)
    setQueuePosition(-1)

    try {
      const res = await generateComfyuiVideo(effectivePrompt.trim(), {
        width,
        height,
        frames,
        steps,
        cfg,
        fps,
        seed: seed > 0 ? seed : undefined,
        workflow: workflow ?? undefined,
      })
      const content = res.choices[0]?.message?.content ?? ''
      const parsed = parseVideoUrls(content)
      setResult(parsed)
      if (parsed.promptId) setCurrentPromptId(parsed.promptId)
      const entry: GenerationEntry = {
        id: parsed.promptId || Date.now().toString(),
        prompt,
        enhancedPrompt,
        width,
        height,
        frames,
        steps,
        seed,
        cfg,
        fps,
        promptId: parsed.promptId,
        videos: parsed.videos,
        workflowName: workflowDetail?.name ?? null,
        createdAt: Date.now(),
      }
      saveHistoryEntry(entry)
      setHistory(loadHistory())
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e)
      setError(msg || t('Video generation failed'))
    } finally {
      setLoading(false)
    }
  }, [effectivePrompt, width, height, frames, steps, seed, cfg, fps, workflow, t])

  // ── Poll queue position during generation ──
  useEffect(() => {
    if (!currentPromptId) return
    let cancelled = false

    const poll = async () => {
      try {
        const status = await pollQueueStatus(currentPromptId)
        if (cancelled) return
        setQueuePosition(status.queue_position)
        if (status.status === 'done' || status.status === 'processing') {
          // Stop showing queue number once processing starts
        }
        if (status.status !== 'done') {
          // Continue polling
          setTimeout(poll, 3000)
        }
      } catch {
        // Silently stop polling on error
      }
    }

    poll()
    return () => { cancelled = true }
  }, [currentPromptId])

  // ── Node inspector data ──
  const selectedNodeParams = useMemo(() => {
    if (!selectedNodeId || !workflowDetail) return []
    return workflowDetail.adjustable_params.filter((p) => p.node_id === selectedNodeId)
  }, [selectedNodeId, workflowDetail])

  const handleNodeParamChange = useCallback(
    (nodeId: string, field: string, value: unknown) => {
      setWorkflow((prev) => {
        if (!prev) return prev
        const updated = writeCommonParam(prev, nodeId, field, value)
        setUndoStack((s) => [...s.slice(-(MAX_HISTORY - 1)), prev])
        setRedoStack([])
        return updated
      })
    },
    [],
  )

  const handleDraftRestore = useCallback(() => {
    const data = loadAutoSave()
    if (!data) {
      setDraftDialogOpen(false)
      handleSelectWorkflow('ltx_t2v')
      return
    }
    clearAutoSave()
    setWorkflowDetail({
      name: data.workflowName ?? 'Draft',
      workflow: data.workflow,
      adjustable_params: data.adjustableParams,
    })
    setWorkflow(data.workflow)
    setSelectedNodeId(null)
    setUndoStack([])
    setRedoStack([])
    setEnhancedPrompt(data.enhancedPrompt)
    setDraftDialogOpen(false)
  }, [])

  const handleDraftDiscard = useCallback(() => {
    clearAutoSave()
    setDraftDialogOpen(false)
    handleSelectWorkflow('ltx_t2v')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── Auto-load default (or show draft dialog) ──
  useEffect(() => {
    if (hasAutoSave()) {
      setDraftDialogOpen(true)
      return
    }
    handleSelectWorkflow('ltx_t2v')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── Auto-save throttle ──
  useEffect(() => {
    if (!workflow) return
    scheduleAutoSave({
      workflow,
      enhancedPrompt,
      workflowName: workflowDetail?.name ?? null,
      adjustableParams: workflowDetail?.adjustable_params ?? [],
      savedAt: Date.now(),
    })
  }, [workflow, enhancedPrompt, workflowDetail])

  const canUndo = undoStack.length > 0
  const canRedo = redoStack.length > 0

  return (
    <div className='flex h-full flex-col relative'>
      {/* ── Header ── */}
      <div className='flex items-center gap-2 border-b px-6 py-3'>
        <h1 className='text-lg font-semibold whitespace-nowrap mr-2'>
          {t('ComfyUI Video Lab')}
        </h1>
        <WorkflowSelector
          onSelect={handleSelectWorkflow}
          selectedName={workflowDetail?.name ?? null}
          loading={wfLoading}
          disabled={loading}
        />
        <div className='flex items-center gap-1 ml-auto'>
          <PresetSelector
            presets={presets}
            disabled={loading}
            onSave={handleSavePreset}
            onLoad={handleLoadPreset}
            onDelete={handleDeletePreset}
            onRename={handleRenamePreset}
          />
          <div className='mx-1 h-5 w-px bg-border' />
          <button
            className='rounded-lg p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-30'
            disabled={!canUndo}
            onClick={handleUndo}
            title={`${t('Undo')} (⌘Z)`}
          >
            <Undo2 className='h-4 w-4' />
          </button>
          <button
            className='rounded-lg p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-30'
            disabled={!canRedo}
            onClick={handleRedo}
            title={`${t('Redo')} (⌘⇧Z)`}
          >
            <Redo2 className='h-4 w-4' />
          </button>
          <button
            className='rounded-lg p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-30'
            disabled={!workflow}
            onClick={handleExport}
            title={t('Export Workflow')}
          >
            <Download className='h-4 w-4' />
          </button>
          <button
            className='rounded-lg p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-30'
            disabled={wfLoading || loading}
            onClick={() => setImportOpen(true)}
            title={t('Import Workflow')}
          >
            <Upload className='h-4 w-4' />
          </button>
          <div className='mx-1 h-5 w-px bg-border' />
          <button
            className='rounded-lg p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-30'
            disabled={!workflow}
            onClick={handleCopy}
            title={copied ? t('Copied!') : t('Copy Workflow')}
          >
            <Copy className='h-4 w-4' />
          </button>
          <button
            className='rounded-lg p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-30'
            disabled={!workflowDetail?.workflow}
            onClick={handleReset}
            title={t('Reset Workflow')}
          >
            <RotateCcw className='h-4 w-4' />
          </button>
          <button
            className='ml-2 flex items-center gap-2 rounded-lg bg-rose-500 px-4 py-2 text-sm font-medium
              text-white transition-colors hover:bg-rose-600 disabled:opacity-50'
            disabled={loading || !effectivePrompt.trim()}
            onClick={handleGenerate}
          >
            {loading ? (
              <span className='flex items-center gap-2'>
                <span className='h-3 w-3 animate-spin rounded-full border-2 border-white border-t-transparent' />
                {queuePosition > 0
                  ? t('Generating video...') + ` (${t('Queue position')}: ${queuePosition})`
                  : t('Generating video...')}
              </span>
            ) : (
              t('Generate')
            )}
          </button>
        </div>
      </div>

      {/* ── Main: sidebar + canvas ── */}
      <div className='flex flex-1 overflow-hidden'>
        <SidebarPanel
          prompt={prompt}
          enhancedPrompt={enhancedPrompt}
          enhancing={enhancing}
          loading={loading}
          width={width}
          height={height}
          frames={frames}
          fps={fps}
          steps={steps}
          seed={seed}
          cfg={cfg}
          selectedNodeId={selectedNodeId}
          selectedNodeParams={selectedNodeParams}
          workflow={workflow}
          error={error}
          onPromptChange={handlePromptChange}
          onEnhance={handleEnhance}
          onWidthChange={handleWidthChange}
          onHeightChange={handleHeightChange}
          onFramesChange={handleFramesChange}
          onFpsChange={handleFpsChange}
          onStepsChange={handleStepsChange}
          onSeedChange={handleSeedChange}
          onRandomSeed={handleRandomSeed}
          onCfgChange={handleCfgChange}
          onPresetSelect={handlePresetSelect}
          onNodeParamChange={handleNodeParamChange}
          history={history}
          onHistoryLoad={handleHistoryLoad}
          onHistoryRefresh={handleHistoryRefresh}
        />

        {/* Right: Canvas */}
        <div className='flex-1'>
          <WorkflowCanvas
            workflow={workflow}
            selectedNodeId={selectedNodeId}
            loading={wfLoading}
            onNodeSelect={setSelectedNodeId}
            onWorkflowChange={handleWorkflowChange}
          />
        </div>
      </div>

      {/* ── Results ── */}
      {result && (
        <div className='border-t p-4'>
          <div className='text-xs text-muted-foreground mb-2'>
            Prompt ID:{' '}
            <code className='rounded bg-muted px-1 py-0.5'>{result.promptId}</code>
          </div>
          <div className='flex gap-4 overflow-x-auto'>
            {result.videos.map((video, i) => (
              <div key={i} className='shrink-0 overflow-hidden rounded-lg border w-[360px]'>
                <div className='border-b bg-muted/50 px-3 py-1.5 text-xs font-medium'>
                  {video.name}
                </div>
                <video controls className='w-full max-h-56' src={video.url}>
                  {t('Your browser does not support video playback.')}
                </video>
                <div className='px-3 py-1.5'>
                  <a
                    href={video.url}
                    download={video.name}
                    className='text-xs text-primary hover:underline'
                    target='_blank'
                    rel='noreferrer'
                  >
                    {t('Download')}
                  </a>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <WorkflowImportDialog
        open={importOpen}
        onClose={() => setImportOpen(false)}
        onImport={handleImport}
      />
      <ShortcutsDialog
        open={shortcutsOpen}
        onClose={() => setShortcutsOpen(false)}
      />
      <RestoreDraftDialog
        open={draftDialogOpen}
        onRestore={handleDraftRestore}
        onDiscard={handleDraftDiscard}
      />
    </div>
  )
}
