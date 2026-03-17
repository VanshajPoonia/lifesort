"use client"

import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { ChevronRight, ChevronDown, Share2, Unlock } from "lucide-react"

interface LinkFolder {
  id: string
  name: string
  color: string
  parent_id?: string | null
  is_public?: boolean
  share_token?: string
}

interface LinkItem {
  id: number
  title: string
  url: string
  description?: string
  thumbnail?: string
  folder_id?: string
  position: number
}

interface FolderItemProps {
  folder: LinkFolder
  level: number
  selectedFolder: string
  setSelectedFolder: (id: string) => void
  expandedFolders: Set<string>
  toggleFolderExpand: (id: string) => void
  getSubfolders: (parentId: string) => LinkFolder[]
  links: LinkItem[]
  handleDeleteFolder: (id: string) => void
  sortOrder: 'asc' | 'desc'
  onShareFolder?: (folder: LinkFolder) => void
}

export function FolderItemComponent({ 
  folder, 
  level, 
  selectedFolder, 
  setSelectedFolder, 
  expandedFolders, 
  toggleFolderExpand, 
  getSubfolders, 
  links, 
  handleDeleteFolder,
  sortOrder,
  onShareFolder
}: FolderItemProps) {
  const subfolders = getSubfolders(folder.id)
  const hasSubfolders = subfolders.length > 0
  const isExpanded = expandedFolders.has(folder.id)
  const linkCount = links.filter(l => l.folder_id === folder.id).length

  return (
    <div>
      <div 
        className="relative group flex items-center"
        style={{ paddingLeft: `${level * 16}px` }}
      >
        {hasSubfolders && (
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 p-0 mr-1"
            onClick={(e) => {
              e.stopPropagation()
              toggleFolderExpand(folder.id)
            }}
          >
            {isExpanded ? (
              <ChevronDown className="h-3 w-3" />
            ) : (
              <ChevronRight className="h-3 w-3" />
            )}
          </Button>
        )}
        {!hasSubfolders && <div className="w-7" />}
        
        <Button
          variant={selectedFolder === folder.id ? "default" : "ghost"}
          size="sm"
          onClick={() => setSelectedFolder(folder.id)}
          className="flex-1 justify-start gap-2"
        >
          <div className={`h-3 w-3 rounded-full ${folder.color}`} />
          {folder.name}
          <Badge variant="secondary" className="ml-auto text-xs">
            {linkCount}
          </Badge>
        </Button>
        
        {onShareFolder && (
          <button
            onClick={(e) => {
              e.stopPropagation()
              onShareFolder(folder)
            }}
            className="h-5 w-5 rounded-full bg-secondary text-secondary-foreground text-xs opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center ml-1"
            title={folder.is_public ? "Shared" : "Share folder"}
          >
            {folder.is_public ? <Unlock className="h-3 w-3 text-green-500" /> : <Share2 className="h-3 w-3" />}
          </button>
        )}
        <button
          onClick={(e) => {
            e.stopPropagation()
            handleDeleteFolder(folder.id)
          }}
          className="h-5 w-5 rounded-full bg-destructive text-destructive-foreground text-xs opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center ml-1"
        >
          ×
        </button>
      </div>
      
      {hasSubfolders && isExpanded && (
        <div className="mt-1">
          {subfolders
            .sort((a, b) => sortOrder === 'asc' ? a.name.localeCompare(b.name) : b.name.localeCompare(a.name))
            .map(subfolder => (
            <FolderItemComponent
              key={subfolder.id}
              folder={subfolder}
              level={level + 1}
              selectedFolder={selectedFolder}
              setSelectedFolder={setSelectedFolder}
              expandedFolders={expandedFolders}
              toggleFolderExpand={toggleFolderExpand}
              getSubfolders={getSubfolders}
              links={links}
              handleDeleteFolder={handleDeleteFolder}
              sortOrder={sortOrder}
              onShareFolder={onShareFolder}
            />
          ))}
        </div>
      )}
    </div>
  )
}
