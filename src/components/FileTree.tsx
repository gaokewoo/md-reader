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

function FileIcon({ type, isOpen }: { type: 'file' | 'directory'; isOpen?: boolean }) {
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
  return (
    <svg className="w-4 h-4 mr-1.5 text-blue-500 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
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
        <FileIcon type={node.type} isOpen={isOpen} />
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
