import { useState } from 'react'

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
  level?: number
}

// Color map based on file extension
function getFileIconColor(name: string): string {
  const ext = name.includes('.') ? name.split('.').pop()!.toLowerCase() : ''
  // No extension or special filenames
  const noExtNames = ['Makefile', 'Dockerfile', 'Vagrantfile', 'Gemfile', 'Rakefile',
    'Procfile', 'Brewfile', 'Podfile', 'Fastfile']
  if (noExtNames.includes(name)) return 'text-green-600'

  const colorMap: Record<string, string> = {
    // Markdown & docs
    md: 'text-blue-500', markdown: 'text-blue-500', txt: 'text-gray-500', text: 'text-gray-500',
    rst: 'text-blue-500', adoc: 'text-blue-500', org: 'text-blue-500', tex: 'text-green-600',
    // Data & config
    json: 'text-yellow-600', yaml: 'text-orange-500', yml: 'text-orange-500', toml: 'text-orange-500',
    xml: 'text-orange-500', csv: 'text-green-600', tsv: 'text-green-600',
    ini: 'text-gray-600', cfg: 'text-gray-600', conf: 'text-gray-600', env: 'text-yellow-700', properties: 'text-gray-600',
    // Logs
    log: 'text-gray-400',
    // Web
    html: 'text-orange-600', htm: 'text-orange-600', css: 'text-blue-400', scss: 'text-pink-500',
    less: 'text-blue-400', sass: 'text-pink-500', vue: 'text-green-500', svelte: 'text-orange-500',
    // JS / TS
    js: 'text-yellow-500', jsx: 'text-yellow-500', ts: 'text-blue-600', tsx: 'text-blue-600',
    mjs: 'text-yellow-500', cjs: 'text-yellow-500',
    // Programming
    py: 'text-green-500', rb: 'text-red-500', go: 'text-cyan-500', rs: 'text-orange-600',
    java: 'text-red-600', c: 'text-blue-700', cpp: 'text-blue-700', h: 'text-purple-600', hpp: 'text-purple-600',
    cs: 'text-green-600', swift: 'text-orange-500', kt: 'text-purple-500', scala: 'text-red-400',
    lua: 'text-blue-500', r: 'text-blue-400', pl: 'text-blue-500', pm: 'text-blue-500', php: 'text-purple-600',
    // Shell
    sh: 'text-green-500', bash: 'text-green-500', zsh: 'text-green-500', fish: 'text-green-500',
    ps1: 'text-blue-500', bat: 'text-green-500', cmd: 'text-green-500',
    // Database
    sql: 'text-blue-500', graphql: 'text-pink-500', proto: 'text-blue-400',
    // Diff
    diff: 'text-purple-500', patch: 'text-purple-500',
    // Other
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

function TreeNode({ node, selectedPath, onSelect, level = 0 }: FileTreeProps & { node: FileNode }) {
  const [isOpen, setIsOpen] = useState(true)
  const isSelected = selectedPath === node.path
  const hasChildren = node.children && node.children.length > 0

  const handleClick = () => {
    if (node.type === 'directory' && hasChildren) {
      setIsOpen(!isOpen)
    }
    onSelect(node.path, node.type)
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
              nodes={[]}
              selectedPath={selectedPath}
              onSelect={onSelect}
              level={level + 1}
            />
          ))}
        </div>
      )}
    </div>
  )
}

export default function FileTree({ nodes, selectedPath, onSelect }: FileTreeProps) {
  return (
    <div className="py-2">
      {nodes.map((node) => (
        <TreeNode
          key={node.path}
          node={node}
          nodes={[]}
          selectedPath={selectedPath}
          onSelect={onSelect}
        />
      ))}
    </div>
  )
}
