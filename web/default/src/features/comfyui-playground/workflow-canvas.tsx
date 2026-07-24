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
import { useState, useCallback, useMemo, useRef } from 'react'
import { ReactFlow, Background, Controls, MiniMap, type Node, type Edge, type Connection } from '@xyflow/react'
import '@xyflow/react/dist/style.css'

import { ComfyuiNode } from './comfyui-node'
import {
  parseWorkflowToGraph,
  addConnectionToWorkflow,
  removeConnectionFromWorkflow,
} from './workflow-parser'
import type { ComfyuiWorkflow, ComfyuiNodeInput, NodePositions } from './types'

const nodeTypes = { comfyui: ComfyuiNode }

interface WorkflowCanvasProps {
  workflow: ComfyuiWorkflow | null
  selectedNodeId: string | null
  loading: boolean
  savedPositions: NodePositions
  onNodeSelect: (nodeId: string | null) => void
  onWorkflowChange: (workflow: ComfyuiWorkflow) => void
  onPositionsChange: (positions: NodePositions) => void
  onNodeDragComplete: () => void
  onViewportCenterChange: (center: { x: number; y: number }) => void
  onDeleteNode: (nodeId: string) => void
}

export function WorkflowCanvas({
  workflow,
  selectedNodeId,
  loading,
  savedPositions,
  onNodeSelect,
  onWorkflowChange,
  onPositionsChange,
  onNodeDragComplete,
  onViewportCenterChange,
  onDeleteNode,
}: WorkflowCanvasProps) {
  const workflowRef = useRef(workflow)
  workflowRef.current = workflow
  const [searchQuery, setSearchQuery] = useState('')
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null)

  const handleInputChange = useCallback(
    (nodeId: string, fieldName: string, value: unknown) => {
      const wf = workflowRef.current
      if (!wf?.[nodeId]) return
      const node = wf[nodeId]
      const updated: ComfyuiWorkflow = {
        ...wf,
        [nodeId]: {
          ...node,
          inputs: { ...node.inputs, [fieldName]: value as ComfyuiNodeInput },
        },
      }
      onWorkflowChange(updated)
    },
    [onWorkflowChange]
  )

  const graph = useMemo(() => {
    if (!workflow) return { nodes: [] as Node[], edges: [] as Edge[] }
    return parseWorkflowToGraph(workflow, handleInputChange, savedPositions, onDeleteNode)
  }, [workflow, handleInputChange, savedPositions, onDeleteNode])

  // Apply search highlight to graph
  const highlightedGraph = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    const { nodes, edges } = graph
    if (!q) return graph

    const matchSet = new Set<string>()
    nodes.forEach((node) => {
      const data = node.data as { classType?: string; title?: string; summary?: string | null }
      const text = `${data.title ?? ''} ${data.classType ?? ''} ${data.summary ?? ''}`.toLowerCase()
      if (text.includes(q)) matchSet.add(node.id)
    })

    return {
      nodes: nodes.map((node) => ({
        ...node,
        data: { ...node.data, dimmed: !matchSet.has(node.id) },
      })),
      edges: edges.map((edge) => {
        const isMatch = matchSet.has(edge.source) && matchSet.has(edge.target)
        return {
          ...edge,
          style: {
            ...edge.style,
            opacity: isMatch ? 1 : 0.15,
            ...(isMatch ? {} : { strokeDasharray: '5 5' }),
          },
        }
      }),
    }
  }, [graph, searchQuery])

  const matchCount = useMemo(() => {
    if (!searchQuery.trim()) return 0
    return highlightedGraph.nodes.filter((n) => !(n.data as { dimmed: boolean }).dimmed).length
  }, [highlightedGraph.nodes, searchQuery])

  // Hover-based edge highlighting: dim non-connected edges
  const displayEdges = useMemo(() => {
    if (!hoveredNodeId) return highlightedGraph.edges
    return highlightedGraph.edges.map((edge) => ({
      ...edge,
      style: {
        ...edge.style,
        opacity: (edge.source === hoveredNodeId || edge.target === hoveredNodeId)
          ? Math.max(Number(edge.style?.opacity) || 1, 0.6)
          : 0.08,
      },
    }))
  }, [highlightedGraph.edges, hoveredNodeId])

  // ── Drag → position persistence ──
  const handleNodeDragStop = useCallback(
    (_event: unknown, node: Node) => {
      onPositionsChange({
        ...savedPositions,
        [node.id]: node.position,
      })
      onNodeDragComplete()
    },
    [savedPositions, onPositionsChange, onNodeDragComplete],
  )

  // ── Drag-to-connect ──
  const handleConnect = useCallback(
    (connection: Connection) => {
      const wf = workflowRef.current
      if (!wf) return
      const { source, target, sourceHandle, targetHandle } = connection
      if (!source || !target || sourceHandle == null || targetHandle == null) return

      const updated = addConnectionToWorkflow(
        wf, source, Number(sourceHandle), target, targetHandle,
      )
      onWorkflowChange(updated)
    },
    [onWorkflowChange],
  )

  // ── Delete selected edges ──
  const handleEdgesDelete = useCallback(
    (deletedEdges: Edge[]) => {
      const wf = workflowRef.current
      if (!wf) return
      let updated = wf
      for (const edge of deletedEdges) {
        const edgeData = edge.data as { targetNodeId?: string; targetField?: string }
        if (edgeData?.targetNodeId && edgeData?.targetField) {
          updated = removeConnectionFromWorkflow(updated, edgeData.targetNodeId, edgeData.targetField)
        }
      }
      onWorkflowChange(updated)
    },
    [onWorkflowChange],
  )

  // ── Track viewport center for new node placement ──
  const handleMove = useCallback(
    (_event: unknown, viewport: { x: number; y: number; zoom: number }) => {
      // Convert screen center to flow coordinates
      const el = document.querySelector('.react-flow__viewport')
      if (el) {
        const rect = el.getBoundingClientRect()
        const centerX = (rect.width / 2 - viewport.x) / viewport.zoom
        const centerY = (rect.height / 2 - viewport.y) / viewport.zoom
        onViewportCenterChange({ x: centerX, y: centerY })
      }
    },
    [onViewportCenterChange],
  )

  return (
    <div className='h-full w-full relative'>
      {/* Search bar */}
      <div className='absolute left-3 top-3 z-10'>
        <input
          type='text'
          className='w-48 rounded-lg border bg-card/90 px-2.5 py-1.5 text-xs
            shadow-sm backdrop-blur-sm placeholder:text-muted-foreground/60
            focus:outline-none focus:ring-2 focus:ring-primary/30'
          placeholder='Search nodes...'
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
        {searchQuery.trim() && (
          <span className='ml-1.5 text-[10px] text-muted-foreground'>
            {matchCount} of {graph.nodes.length}
          </span>
        )}
      </div>

      {loading && (
        <div className='absolute inset-0 z-10 flex items-center justify-center bg-background/60 backdrop-blur-sm'>
          <div className='flex flex-col items-center gap-2'>
            <div className='h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent' />
            <span className='text-xs text-muted-foreground'>Loading workflow...</span>
          </div>
        </div>
      )}
      <ReactFlow
        nodes={highlightedGraph.nodes}
        edges={displayEdges}
        nodeTypes={nodeTypes}
        onNodesChange={() => {}}
        onEdgesChange={() => {}}
        onNodeClick={(_, node) => onNodeSelect(node.id)}
        onNodeMouseEnter={(_, node) => setHoveredNodeId(node.id)}
        onNodeMouseLeave={() => setHoveredNodeId(null)}
        onPaneClick={() => onNodeSelect(null)}
        fitView
        fitViewOptions={{ padding: 0.2 }}
        minZoom={0.2}
        maxZoom={2}
        nodesDraggable={true}
        nodesConnectable={true}
        elementsSelectable={true}
        onNodeDragStop={handleNodeDragStop}
        onConnect={handleConnect}
        onEdgesDelete={handleEdgesDelete}
        onMove={handleMove}
        proOptions={{ hideAttribution: true }}
        deleteKeyCode={['Backspace', 'Delete']}
      >
        <Background bgColor='var(--sidebar)' />
        <Controls />
        <MiniMap nodeStrokeWidth={2} pannable zoomable nodeColor='var(--primary)' />
      </ReactFlow>
    </div>
  )
}
