import { useState, useCallback } from 'react'

export interface FileNode {
  name: string
  path: string
  type: 'file' | 'directory'
  children?: FileNode[]
}

interface FileTreeProps {
  nodes: FileNode[]
  selectedPath: string | null
  onSelect: (path: string, type: 'file' | 'directory') => void
  collapsed?: boolean
  onToggleCollapse?: () => void
  onCollapseAll?: () => void
  workspaceName?: string
  workspacePath?: string
  onRemoveWorkspace?: () => void
}

// Color map based on file extension
function getFileIconColor(name: string): string {
  const ext = name.includes('.') ? name.split('.').pop()!.toLowerCase() : ''
  const noExtNames = ['Makefile', 'Dockerfile', 'Vagrantfile', 'Gemfile', 'Rakefile',
    'Procfile', 'Brewfile', 'Podfile', 'Fastfile']
  if (noExtNames.includes(name)) return 'text-green-600'

  const colorMap: Record<string, string> = {
    md: 'text-blue-500', markdown: 'text-blue-500', txt: 'text-gray-500', text: 'text-gray-500',
    rst: 'text-blue-500', adoc: 'text-blue-500', org: 'text-blue-500', tex: 'text-green-600',
    json: 'text-yellow-600', yaml: 'text-orange-500', yml: 'text-orange-500', toml: 'text-orange-500',
    xml: 'text-orange-500', csv: 'text-green-600', tsv: 'text-green-600',
    ini: 'text-gray-600', cfg: 'text-gray-600', conf: 'text-gray-600', env: 'text-yellow-700', properties: 'text-gray-600',
    log: 'text-gray-400',
    html: 'text-orange-600', htm: 'text-orange-600', css: 'text-blue-400', scss: 'text-pink-500',
    less: 'text-blue-400', sass: 'text-pink-500', vue: 'text-green-500', svelte: 'text-orange-500',
    js: 'text-yellow-500', jsx: 'text-yellow-500', ts: 'text-blue-600', tsx: 'text-blue-600',
    mjs: 'text-yellow-500', cjs: 'text-yellow-500',
    py: 'text-green-500', rb: 'text-red-500', go: 'text-cyan-500', rs: 'text-orange-600',
    java: 'text-red-600', c: 'text-blue-700', cpp: 'text-blue-700', h: 'text-purple-600', hpp: 'text-purple-600',
    cs: 'text-green-600', swift: 'text-orange-500', kt: 'text-purple-500', scala: 'text-red-400',
    lua: 'text-blue-500', r: 'text-blue-400', pl: 'text-blue-500', pm: 'text-blue-500', php: 'text-purple-600',
    sh: 'text-green-500', bash: 'text-green-500', zsh: 'text-green-500', fish: 'text-green-500',
    ps1: 'text-blue-500', bat: 'text-green-500', cmd: 'text-green-500',
    sql: 'text-blue-500', graphql: 'text-pink-500', proto: 'text-blue-400',
    diff: 'text-purple-500', patch: 'text-purple-500',
    dockerfile: 'text-blue-400', makefile: 'text-green-600', cmake: 'text-green-600', gradle: 'text-green-600',
  }
  return colorMap[ext] || 'text-gray-500'
}

function FileIcon({ type, isOpen, name }: { type: 'file' | 'directory'; isOpen?: boolean; name?: string }) {
  if (type === 'directory') {
    return (
      <svg className="w-4 h-4 mr-1.5 text-yellow-500 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
        {isOpen ? (
          <path d="M2 6a2 2 0 012-2h5l2 2h5a2 2 0 012 2v6a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" />
        ) : (
          <path fillRule="evenodd" d="M4 4a2 2 0 00-2 2v8a2 2 0 002 2h12a2 2 0 002-2V8a2 2 0 00-2-2h-5L9 4H4zm7 5a1 1 0 10-2 0v1H8a1 1 0 100 2h1v1a1 1 0 102 0v-1h1a1 1 0 100-2h-1V9z" clipRule="evenodd" />
        )}
      </svg>
    )
  }
  const color = name ? getFileIconColor(name) : 'text-blue-500'
  return (
    <svg className={`w-4 h-4 mr-1.5 flex-shrink-0 ${color}`} fill="currentColor" viewBox="0 0 20 20">
      <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" clipRule="evenodd" />
    </svg>
  )
}

// Collect all directory paths in a tree for "collapse all"
function collectDirPaths(nodes: FileNode[]): string[] {
  const paths: string[] = []
  for (const node of nodes) {
    if (node.type === 'directory') {
      paths.push(node.path)
      if (node.children) paths.push(...collectDirPaths(node.children))
    }
  }
  return paths
}

interface TreeNodeProps {
  node: FileNode
  selectedPath: string | null
  onSelect: (path: string, type: 'file' | 'directory') => void
  level?: number
  collapsedDirs: Set<string>
  onToggleDir: (path: string) => void
}

function TreeNode({ node, selectedPath, onSelect, level = 0, collapsedDirs, onToggleDir }: TreeNodeProps) {
  const isSelected = selectedPath === node.path
  const hasChildren = node.children && node.children.length > 0
  const isOpen = !collapsedDirs.has(node.path)

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (node.type === 'directory') {
      onToggleDir(node.path)
    }
    if (node.type === 'file') {
      onSelect(node.path, node.type)
    }
  }

  return (
    <div>
      <div
        className={`flex items-center py-1 px-2 cursor-pointer text-sm rounded-md mx-1 transition-colors ${
          isSelected
            ? 'bg-blue-100 text-blue-700'
            : 'hover:bg-gray-100 text-gray-700'
        }`}
        style={{ paddingLeft: `${level * 12 + 8}px` }}
        onClick={handleClick}
      >
        {node.type === 'directory' && hasChildren && (
          <svg
            className={`w-3 h-3 mr-1 text-gray-400 transition-transform flex-shrink-0 ${isOpen ? 'rotate-90' : ''}`}
            fill="currentColor"
            viewBox="0 0 20 20"
          >
            <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
          </svg>
        )}
        {node.type === 'directory' && !hasChildren && (
          <span className="w-3 mr-1 flex-shrink-0" />
        )}
        {node.type === 'file' && <span className="w-4 mr-1 flex-shrink-0" />}
        <FileIcon type={node.type} isOpen={isOpen} name={node.name} />
        <span className="truncate select-none">{node.name}</span>
      </div>
      {node.type === 'directory' && isOpen && hasChildren && (
        <div>
          {node.children!.map((child) => (
            <TreeNode
              key={child.path}
              node={child}
              selectedPath={selectedPath}
              onSelect={onSelect}
              level={level + 1}
              collapsedDirs={collapsedDirs}
              onToggleDir={onToggleDir}
            />
          ))}
        </div>
      )}
    </div>
  )
}

export default function FileTree({ nodes, selectedPath, onSelect, collapsed, onToggleCollapse, onCollapseAll, workspaceName, workspacePath, onRemoveWorkspace }: FileTreeProps) {
  const [collapsedDirs, setCollapsedDirs] = useState<Set<string>>(new Set())

  const handleToggleDir = useCallback((path: string) => {
    setCollapsedDirs(prev => {
      const next = new Set(prev)
      if (next.has(path)) next.delete(path)
      else next.add(path)
      return next
    })
  }, [])

  const handleCollapseAll = useCallback(() => {
    const allDirs = collectDirPaths(nodes)
    setCollapsedDirs(new Set(allDirs))
    onCollapseAll?.()
  }, [nodes, onCollapseAll])

  const handleExpandAll = useCallback(() => {
    setCollapsedDirs(new Set())
  }, [])

  const isCollapsed = collapsed ?? false

  return (
    <div className="border-b border-gray-200 last:border-b-0">
      {/* Workspace header */}
      <div className="flex items-center px-2 py-1.5 bg-gray-100 border-b border-gray-200 group">
        {/* Collapse/expand chevron for workspace */}
        <button
          className="w-4 h-4 flex items-center justify-center mr-1 rounded hover:bg-gray-200 text-gray-400 hover:text-gray-600 flex-shrink-0"
          onClick={onToggleCollapse}
          title={isCollapsed ? '展开' : '折叠'}
        >
          <svg
            className={`w-3 h-3 transition-transform ${isCollapsed ? '' : 'rotate-90'}`}
            fill="currentColor"
            viewBox="0 0 20 20"
          >
            <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
          </svg>
        </button>
        <svg className="w-3.5 h-3.5 text-yellow-500 mr-1.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
          <path d="M2 6a2 2 0 012-2h5l2 2h5a2 2 0 012 2v6a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" />
        </svg>
        <span className="text-xs font-medium text-gray-600 truncate flex-1" title={workspacePath}>{workspaceName}</span>
        {/* Collapse all / Expand all buttons */}
        {!isCollapsed && (
          <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
            <button
              className="w-5 h-5 flex items-center justify-center rounded hover:bg-gray-200 text-gray-400 hover:text-gray-600"
              onClick={handleCollapseAll}
              title="全部折叠"
            >
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            <button
              className="w-5 h-5 flex items-center justify-center rounded hover:bg-gray-200 text-gray-400 hover:text-gray-600"
              onClick={handleExpandAll}
              title="全部展开"
            >
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
              </svg>
            </button>
          </div>
        )}
        {/* Remove workspace */}
        {onRemoveWorkspace && (
          <button
            className="w-5 h-5 flex items-center justify-center rounded hover:bg-gray-200 text-gray-400 hover:text-gray-600 opacity-0 group-hover:opacity-100 transition-opacity ml-0.5"
            onClick={onRemoveWorkspace}
            title="移除文件夹"
          >
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>
      {/* Tree content */}
      {!isCollapsed && (
        <div className="py-1">
          {nodes.map((node) => (
            <TreeNode
              key={node.path}
              node={node}
              selectedPath={selectedPath}
              onSelect={onSelect}
              level={0}
              collapsedDirs={collapsedDirs}
              onToggleDir={handleToggleDir}
            />
          ))}
        </div>
      )}
    </div>
  )
}
