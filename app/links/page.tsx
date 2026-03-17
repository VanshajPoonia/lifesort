"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/components/auth-provider"
import { DashboardLayout } from "@/components/dashboard-layout"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { 
  Plus, 
  Trash2, 
  ExternalLink, 
  Link as LinkIcon, 
  Folder, 
  FolderPlus,
  Edit2,
  Check,
  X,
  Youtube,
  Globe,
  ImageIcon,
  ChevronRight,
  ChevronDown,
  ArrowUpAZ,
  ArrowDownAZ,
  FolderOpen,
  Upload,
  Share2,
  Copy,
  Lock,
  Unlock,
  Eye,
  Download,
} from "lucide-react"
import { useRef } from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { FolderItemComponent } from "@/components/folder-item"

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
  link_type?: string
  file_data?: string
  is_public?: boolean
  share_token?: string
  share_permission?: string
}

const DEFAULT_FOLDERS: LinkFolder[] = [
  { id: 'all', name: 'All Links', color: 'bg-primary' },
]

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
}

const FOLDER_COLORS = [
  'bg-red-500', 'bg-orange-500', 'bg-amber-500', 'bg-yellow-500',
  'bg-lime-500', 'bg-green-500', 'bg-emerald-500', 'bg-teal-500',
  'bg-cyan-500', 'bg-sky-500', 'bg-blue-500', 'bg-indigo-500',
  'bg-violet-500', 'bg-purple-500', 'bg-fuchsia-500', 'bg-pink-500',
]

export default function LinksPage() {
  const { user, loading } = useAuth()
  const router = useRouter()
  const [links, setLinks] = useState<LinkItem[]>([])
  const [folders, setFolders] = useState<LinkFolder[]>(DEFAULT_FOLDERS)
  const [selectedFolder, setSelectedFolder] = useState('all')
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
  const [isFolderDialogOpen, setIsFolderDialogOpen] = useState(false)
  const [editingLink, setEditingLink] = useState<LinkItem | null>(null)
  const [newLink, setNewLink] = useState({ title: '', url: '', description: '', folder_id: '', thumbnail: '' })
  const [newFolder, setNewFolder] = useState({ name: '', color: FOLDER_COLORS[0], parent_id: '' })
  const [fetchingPreview, setFetchingPreview] = useState(false)
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc')
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set())
  const [isUploadDialogOpen, setIsUploadDialogOpen] = useState(false)
  const [isShareDialogOpen, setIsShareDialogOpen] = useState(false)
  const [sharingItem, setSharingItem] = useState<{type: 'link' | 'folder', id: string, is_public: boolean, share_token?: string, share_permission?: string} | null>(null)
  const [uploadingImage, setUploadingImage] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [newImage, setNewImage] = useState({ title: '', description: '', folder_id: '', file_data: '' })

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login')
    } else if (user) {
      fetchLinks()
      loadFolders()
    }
  }, [user, loading, router])

  const loadFolders = async () => {
    try {
      const response = await fetch('/api/link-folders')
      if (response.ok) {
        const data = await response.json()
        // Convert id to string for consistency
        const dbFolders = data.map((f: { id: number; name: string; color: string; parent_id?: number | null; is_public?: boolean; share_token?: string }) => ({
          id: f.id.toString(),
          name: f.name,
          color: f.color,
          parent_id: f.parent_id?.toString() || null,
          is_public: f.is_public || false,
          share_token: f.share_token,
        }))
        setFolders([...DEFAULT_FOLDERS, ...dbFolders])
      }
    } catch (error) {
      console.error('[v0] Error loading folders:', error)
    }
  }

  const toggleFolderExpand = (folderId: string) => {
    setExpandedFolders(prev => {
      const newSet = new Set(prev)
      if (newSet.has(folderId)) {
        newSet.delete(folderId)
      } else {
        newSet.add(folderId)
      }
      return newSet
    })
  }

  const getSubfolders = (parentId: string) => {
    return folders.filter(f => f.parent_id === parentId)
  }

  const getRootFolders = () => {
    return folders.filter(f => f.id !== 'all' && !f.parent_id)
  }

  const sortedFolders = () => {
    const sorted = [...folders].filter(f => f.id !== 'all')
    sorted.sort((a, b) => {
      const comparison = a.name.localeCompare(b.name)
      return sortOrder === 'asc' ? comparison : -comparison
    })
    return sorted
  }

  const getAllChildFolderIds = (parentId: string): string[] => {
    const children = folders.filter(f => f.parent_id === parentId)
    let ids = children.map(f => f.id)
    for (const child of children) {
      ids = [...ids, ...getAllChildFolderIds(child.id)]
    }
    return ids
  }

  const fetchLinks = async () => {
    try {
      const response = await fetch('/api/links')
      if (response.ok) {
        const data = await response.json()
        setLinks(data)
      }
    } catch (error) {
      console.error('[v0] Error fetching links:', error)
    }
  }

  const getYouTubeId = (url: string) => {
    const regex = /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/
    const match = url.match(regex)
    return match ? match[1] : null
  }

  const isYouTubeUrl = (url: string) => {
    return url.includes('youtube.com') || url.includes('youtu.be')
  }

  const getThumbnail = (url: string) => {
    const youtubeId = getYouTubeId(url)
    if (youtubeId) {
      return `https://img.youtube.com/vi/${youtubeId}/mqdefault.jpg`
    }
    return null
  }

  const fetchUrlPreview = async (url: string) => {
    if (!url) return
    
    let formattedUrl = url
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      formattedUrl = 'https://' + url
    }
    
    setFetchingPreview(true)
    try {
      const response = await fetch('/api/url-preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: formattedUrl }),
      })
      if (response.ok) {
        const data = await response.json()
        if (data.thumbnail) {
          setNewLink(prev => ({ ...prev, thumbnail: data.thumbnail }))
        }
        if (data.title && !newLink.title) {
          setNewLink(prev => ({ ...prev, title: data.title }))
        }
      }
    } catch (error) {
      console.error('[v0] Error fetching preview:', error)
    } finally {
      setFetchingPreview(false)
    }
  }

  const fetchEditUrlPreview = async (url: string) => {
    if (!url || !editingLink) return
    
    let formattedUrl = url
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      formattedUrl = 'https://' + url
    }
    
    setFetchingPreview(true)
    try {
      const response = await fetch('/api/url-preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: formattedUrl }),
      })
      if (response.ok) {
        const data = await response.json()
        if (data.thumbnail) {
          setEditingLink({ ...editingLink, thumbnail: data.thumbnail })
        }
      }
    } catch (error) {
      console.error('[v0] Error fetching preview:', error)
    } finally {
      setFetchingPreview(false)
    }
  }

  const handleAddLink = async () => {
    if (!newLink.title.trim() || !newLink.url.trim()) return

    let url = newLink.url
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      url = 'https://' + url
    }

    try {
      const response = await fetch('/api/links', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...newLink,
          url,
          thumbnail: newLink.thumbnail || getThumbnail(url),
        }),
      })

      if (response.ok) {
        await fetchLinks()
        setNewLink({ title: '', url: '', description: '', folder_id: '', thumbnail: '' })
        setIsDialogOpen(false)
      }
    } catch (error) {
      console.error('[v0] Error adding link:', error)
    }
  }

  const handleUpdateLink = async () => {
    if (!editingLink) return

    let url = editingLink.url
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      url = 'https://' + url
    }

    try {
      const response = await fetch('/api/links', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...editingLink,
          url,
          thumbnail: editingLink.thumbnail || getThumbnail(url),
        }),
      })

      if (response.ok) {
        await fetchLinks()
        setEditingLink(null)
        setIsEditDialogOpen(false)
      }
    } catch (error) {
      console.error('[v0] Error updating link:', error)
    }
  }

  const handleDeleteLink = async (id: number) => {
    if (!confirm('Delete this link?')) return

    try {
      const response = await fetch('/api/links', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      })

      if (response.ok) {
        setLinks(links.filter(l => l.id !== id))
      }
    } catch (error) {
      console.error('[v0] Error deleting link:', error)
    }
  }

  const handleAddFolder = async () => {
    if (!newFolder.name.trim()) return

    try {
      const response = await fetch('/api/link-folders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newFolder.name,
          color: newFolder.color,
          parent_id: newFolder.parent_id ? parseInt(newFolder.parent_id) : null,
        }),
      })

      if (response.ok) {
        await loadFolders()
        // Expand the parent folder if creating a subfolder
        if (newFolder.parent_id) {
          setExpandedFolders(prev => new Set([...prev, newFolder.parent_id]))
        }
        setNewFolder({ name: '', color: FOLDER_COLORS[0], parent_id: '' })
        setIsFolderDialogOpen(false)
      }
    } catch (error) {
      console.error('[v0] Error creating folder:', error)
    }
  }

  const handleDeleteFolder = async (folderId: string) => {
    if (!confirm('Delete this folder? Links will not be deleted.')) return
    
    try {
      const response = await fetch('/api/link-folders', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: parseInt(folderId) }),
      })

      if (response.ok) {
        await loadFolders()
        if (selectedFolder === folderId) {
          setSelectedFolder('all')
        }
      }
    } catch (error) {
      console.error('[v0] Error deleting folder:', error)
    }
  }

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (!file.type.startsWith('image/')) {
      alert('Please select an image file')
      return
    }

    setUploadingImage(true)
    const reader = new FileReader()
    reader.onloadend = () => {
      const base64 = reader.result as string
      setNewImage(prev => ({ ...prev, file_data: base64 }))
      setUploadingImage(false)
    }
    reader.readAsDataURL(file)
  }

  const handleAddImage = async () => {
    if (!newImage.file_data) return

    try {
      const response = await fetch('/api/links', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: newImage.title || 'Uploaded Image',
          url: '',
          description: newImage.description,
          folder_id: newImage.folder_id,
          thumbnail: newImage.file_data,
          link_type: 'image',
          file_data: newImage.file_data,
        }),
      })

      if (response.ok) {
        await fetchLinks()
        setNewImage({ title: '', description: '', folder_id: '', file_data: '' })
        setIsUploadDialogOpen(false)
      }
    } catch (error) {
      console.error('[v0] Error uploading image:', error)
    }
  }

  const handleShare = async (type: 'link' | 'folder', id: string, makePublic: boolean, permission: string = 'view') => {
    try {
      const response = await fetch('/api/share', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: parseInt(id),
          type,
          is_public: makePublic,
          share_permission: permission,
        }),
      })

      if (response.ok) {
        const result = await response.json()
        if (type === 'link') {
          await fetchLinks()
        } else {
          await loadFolders()
        }
        
        if (makePublic && result.share_token) {
          setSharingItem({
            type,
            id,
            is_public: true,
            share_token: result.share_token,
            share_permission: permission,
          })
        } else {
          setSharingItem(null)
          setIsShareDialogOpen(false)
        }
      }
    } catch (error) {
      console.error('[v0] Error sharing:', error)
    }
  }

  const copyShareLink = (token: string) => {
    const shareUrl = `${window.location.origin}/share/${token}`
    navigator.clipboard.writeText(shareUrl)
    alert('Share link copied to clipboard!')
  }

  const filteredLinks = selectedFolder === 'all' 
    ? links 
    : links.filter(l => {
        if (l.folder_id === selectedFolder) return true
        // Also include links from subfolders
        const childIds = getAllChildFolderIds(selectedFolder)
        return childIds.includes(l.folder_id || '')
      })

  if (loading || !user) {
    return (
      <DashboardLayout>
        <div className="flex h-screen items-center justify-center">
          <div className="text-center">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent mx-auto" />
            <p className="mt-4 text-muted-foreground">Loading...</p>
          </div>
        </div>
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout title="My Links" subtitle="Your personal link collection with folders">
      <div className="space-y-6">
        {/* Folders Section */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <CardTitle className="text-lg">Folders</CardTitle>
              <div className="flex items-center gap-2">
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={() => setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc')}
                  title={sortOrder === 'asc' ? 'Sort Z-A' : 'Sort A-Z'}
                >
                  {sortOrder === 'asc' ? <ArrowUpAZ className="h-4 w-4" /> : <ArrowDownAZ className="h-4 w-4" />}
                </Button>
                <Button variant="outline" size="sm" onClick={() => setIsFolderDialogOpen(true)}>
                  <FolderPlus className="mr-2 h-4 w-4" />
                  New Folder
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-1">
              {/* All Links button */}
              <Button
                variant={selectedFolder === 'all' ? "default" : "ghost"}
                size="sm"
                onClick={() => setSelectedFolder('all')}
                className="w-full justify-start gap-2"
              >
                <Folder className="h-4 w-4" />
                All Links
                <Badge variant="secondary" className="ml-auto text-xs">
                  {links.length}
                </Badge>
              </Button>
              
              {/* Root folders with hierarchy */}
              {getRootFolders()
                .sort((a, b) => sortOrder === 'asc' ? a.name.localeCompare(b.name) : b.name.localeCompare(a.name))
                .map((folder) => (
                <FolderItemComponent 
                  key={folder.id} 
                  folder={folder} 
                  level={0}
                  selectedFolder={selectedFolder}
                  setSelectedFolder={setSelectedFolder}
                  expandedFolders={expandedFolders}
                  toggleFolderExpand={toggleFolderExpand}
                  getSubfolders={getSubfolders}
                  links={links}
                  handleDeleteFolder={handleDeleteFolder}
                  sortOrder={sortOrder}
                  onShareFolder={(f) => {
                    setSharingItem({
                      type: 'folder',
                      id: f.id,
                      is_public: f.is_public || false,
                      share_token: f.share_token,
                      share_permission: 'view',
                    })
                    setIsShareDialogOpen(true)
                  }}
                />
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Action Buttons */}
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => setIsUploadDialogOpen(true)}>
            <Upload className="mr-2 h-4 w-4" />
            Upload Image
          </Button>
          <Button onClick={() => setIsDialogOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Add Link
          </Button>
        </div>

        {/* Links Grid */}
        {filteredLinks.length === 0 ? (
          <Card className="p-12 text-center">
            <LinkIcon className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
            <h2 className="text-lg font-semibold text-foreground mb-2">No Links Yet</h2>
            <p className="text-sm text-muted-foreground mb-4">
              Start building your personal link collection
            </p>
            <Button onClick={() => setIsDialogOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Add Your First Link
            </Button>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {filteredLinks.map((link) => {
              const isYoutube = isYouTubeUrl(link.url)
              const youtubeId = getYouTubeId(link.url)
              
              return (
                <Card key={link.id} className="hover:shadow-lg transition-all group overflow-hidden">
                  {/* Thumbnail/Preview */}
                  {isYoutube && youtubeId ? (
                    <div className="relative aspect-video bg-muted">
                      <img
                        src={`https://img.youtube.com/vi/${youtubeId}/mqdefault.jpg`}
                        alt={link.title}
                        className="w-full h-full object-cover"
                      />
                      <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                        <Youtube className="h-12 w-12 text-red-500" />
                      </div>
                    </div>
                  ) : link.thumbnail ? (
                    <div className="relative aspect-video bg-muted">
                      <img
                        src={link.thumbnail || "/placeholder.svg"}
                        alt={link.title}
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          e.currentTarget.style.display = 'none'
                          e.currentTarget.parentElement?.classList.add('flex', 'items-center', 'justify-center')
                        }}
                      />
                    </div>
                  ) : (
                    <div className="aspect-video bg-gradient-to-br from-primary/10 to-accent/10 flex items-center justify-center">
                      <Globe className="h-12 w-12 text-muted-foreground" />
                    </div>
                  )}

                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-foreground truncate">
                          {link.title}
                        </h3>
                        {link.description && (
                          <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                            {link.description}
                          </p>
                        )}
                        <p className="text-xs text-primary mt-2 truncate">
                          {link.url}
                        </p>
                        {link.folder_id && (
                          <Badge variant="outline" className="mt-2 text-xs">
                            <Folder className="h-3 w-3 mr-1" />
                            {folders.find(f => f.id === link.folder_id)?.name || 'Unknown'}
                          </Badge>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 mt-4 pt-4 border-t border-border">
                      {link.link_type === 'image' ? (
                        <Button 
                          variant="default" 
                          size="sm" 
                          className="flex-1"
                          onClick={() => {
                            const a = document.createElement('a')
                            a.href = link.file_data || link.thumbnail || ''
                            a.download = link.title || 'image'
                            a.click()
                          }}
                        >
                          <Download className="mr-2 h-4 w-4" />
                          Download
                        </Button>
                      ) : (
                        <a 
                          href={link.url} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="flex-1"
                        >
                          <Button variant="default" size="sm" className="w-full">
                            <ExternalLink className="mr-2 h-4 w-4" />
                            Open Link
                          </Button>
                        </a>
                      )}
                      <Button 
                        variant="outline" 
                        size="icon"
                        onClick={() => {
                          setSharingItem({
                            type: 'link',
                            id: link.id.toString(),
                            is_public: link.is_public || false,
                            share_token: link.share_token,
                            share_permission: link.share_permission || 'view',
                          })
                          setIsShareDialogOpen(true)
                        }}
                        title={link.is_public ? "Shared" : "Share"}
                      >
                        {link.is_public ? <Unlock className="h-4 w-4 text-green-500" /> : <Share2 className="h-4 w-4" />}
                      </Button>
                      <Button 
                        variant="outline" 
                        size="icon"
                        onClick={() => {
                          setEditingLink(link)
                          setIsEditDialogOpen(true)
                        }}
                      >
                        <Edit2 className="h-4 w-4" />
                      </Button>
                      <Button 
                        variant="outline" 
                        size="icon"
                        onClick={() => handleDeleteLink(link.id)}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        )}
      </div>

      {/* Add Link Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="bg-background">
          <DialogHeader>
            <DialogTitle>Add New Link</DialogTitle>
            <DialogDescription>
              Add a link to your collection. YouTube links will show video previews.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Title</Label>
              <Input
                placeholder="My Favorite Video"
                value={newLink.title}
                onChange={(e) => setNewLink({ ...newLink, title: e.target.value })}
                className="text-foreground"
              />
            </div>
            <div className="space-y-2">
              <Label>URL</Label>
              <div className="flex gap-2">
                <Input
                  placeholder="https://youtube.com/watch?v=..."
                  value={newLink.url}
                  onChange={(e) => setNewLink({ ...newLink, url: e.target.value })}
                  onBlur={(e) => fetchUrlPreview(e.target.value)}
                  className="text-foreground flex-1"
                />
                {fetchingPreview && (
                  <div className="flex items-center px-3">
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                  </div>
                )}
              </div>
              {newLink.thumbnail && (
                <div className="mt-2 rounded-lg overflow-hidden border border-border">
                  <img src={newLink.thumbnail || "/placeholder.svg"} alt="Preview" className="w-full h-32 object-cover" />
                </div>
              )}
            </div>
            <div className="space-y-2">
              <Label>Folder (Optional)</Label>
              <Select
                value={newLink.folder_id || "none"}
                onValueChange={(value) => {
                  if (value === "create_new") {
                    setIsDialogOpen(false)
                    setIsFolderDialogOpen(true)
                  } else {
                    setNewLink({ ...newLink, folder_id: value === "none" ? "" : value })
                  }
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a folder" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No folder</SelectItem>
                  {folders.filter(f => f.id !== 'all').map((folder) => (
                    <SelectItem key={folder.id} value={folder.id}>
                      <div className="flex items-center gap-2">
                        <div className={`h-3 w-3 rounded-full ${folder.color}`} />
                        {folder.name}
                      </div>
                    </SelectItem>
                  ))}
                  <SelectItem value="create_new">
                    <div className="flex items-center gap-2 text-primary">
                      <FolderPlus className="h-4 w-4" />
                      Create New Folder
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Description (Optional)</Label>
              <Textarea
                placeholder="Brief description"
                value={newLink.description}
                onChange={(e) => setNewLink({ ...newLink, description: e.target.value })}
                className="text-foreground"
              />
            </div>
            <Button onClick={handleAddLink} className="w-full">
              Add Link
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Link Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="bg-background">
          <DialogHeader>
            <DialogTitle>Edit Link</DialogTitle>
          </DialogHeader>
          {editingLink && (
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Title</Label>
                <Input
                  value={editingLink.title}
                  onChange={(e) => setEditingLink({ ...editingLink, title: e.target.value })}
                  className="text-foreground"
                />
              </div>
              <div className="space-y-2">
                <Label>URL</Label>
                <div className="flex gap-2">
                  <Input
                    value={editingLink.url}
                    onChange={(e) => setEditingLink({ ...editingLink, url: e.target.value })}
                    onBlur={(e) => fetchEditUrlPreview(e.target.value)}
                    className="text-foreground flex-1"
                  />
                  {fetchingPreview && (
                    <div className="flex items-center px-3">
                      <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                    </div>
                  )}
                </div>
                {editingLink.thumbnail && (
                  <div className="mt-2 rounded-lg overflow-hidden border border-border">
                    <img src={editingLink.thumbnail || "/placeholder.svg"} alt="Preview" className="w-full h-32 object-cover" />
                  </div>
                )}
              </div>
              <div className="space-y-2">
                <Label>Folder</Label>
                <Select
                  value={editingLink.folder_id || "none"}
                  onValueChange={(value) => setEditingLink({ ...editingLink, folder_id: value === "none" ? undefined : value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select a folder" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No folder</SelectItem>
                    {folders.filter(f => f.id !== 'all').map((folder) => (
                      <SelectItem key={folder.id} value={folder.id}>
                        <div className="flex items-center gap-2">
                          <div className={`h-3 w-3 rounded-full ${folder.color}`} />
                          {folder.name}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Description</Label>
                <Textarea
                  value={editingLink.description || ''}
                  onChange={(e) => setEditingLink({ ...editingLink, description: e.target.value })}
                  className="text-foreground"
                />
              </div>
              <div className="flex gap-2">
                <Button onClick={handleUpdateLink} className="flex-1">
                  Save Changes
                </Button>
                <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>
                  Cancel
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Add Folder Dialog */}
      <Dialog open={isFolderDialogOpen} onOpenChange={setIsFolderDialogOpen}>
        <DialogContent className="bg-background">
          <DialogHeader>
            <DialogTitle>Create New Folder</DialogTitle>
            <DialogDescription>
              Create a folder or subfolder to organize your links
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Folder Name</Label>
              <Input
                placeholder="My Folder"
                value={newFolder.name}
                onChange={(e) => setNewFolder({ ...newFolder, name: e.target.value })}
                className="text-foreground"
              />
            </div>
            <div className="space-y-2">
              <Label>Parent Folder (Optional)</Label>
              <Select
                value={newFolder.parent_id || "none"}
                onValueChange={(value) => setNewFolder({ ...newFolder, parent_id: value === "none" ? "" : value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select parent folder (optional)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">
                    <div className="flex items-center gap-2">
                      <Folder className="h-4 w-4" />
                      No parent (root level)
                    </div>
                  </SelectItem>
                  {folders.filter(f => f.id !== 'all').map((folder) => (
                    <SelectItem key={folder.id} value={folder.id}>
                      <div className="flex items-center gap-2">
                        <div className={`h-3 w-3 rounded-full ${folder.color}`} />
                        {folder.parent_id && <span className="text-muted-foreground mr-1">└</span>}
                        {folder.name}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Select a parent folder to create a subfolder inside it
              </p>
            </div>
            <div className="space-y-2">
              <Label>Color</Label>
              <div className="flex flex-wrap gap-2">
                {FOLDER_COLORS.map((color) => (
                  <button
                    key={color}
                    onClick={() => setNewFolder({ ...newFolder, color })}
                    className={`h-8 w-8 rounded-full ${color} ${
                      newFolder.color === color ? 'ring-2 ring-offset-2 ring-primary' : ''
                    }`}
                  />
                ))}
              </div>
            </div>
            <Button onClick={handleAddFolder} className="w-full">
              <FolderPlus className="mr-2 h-4 w-4" />
              {newFolder.parent_id ? 'Create Subfolder' : 'Create Folder'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Upload Image Dialog */}
      <Dialog open={isUploadDialogOpen} onOpenChange={setIsUploadDialogOpen}>
        <DialogContent className="bg-background">
          <DialogHeader>
            <DialogTitle>Upload Image</DialogTitle>
            <DialogDescription>
              Upload an image from your device to your collection
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleFileUpload}
              className="hidden"
            />
            
            {newImage.file_data ? (
              <div className="relative rounded-lg overflow-hidden border border-border">
                <img 
                  src={newImage.file_data} 
                  alt="Preview" 
                  className="w-full h-48 object-cover"
                />
                <Button
                  type="button"
                  variant="destructive"
                  size="icon"
                  className="absolute top-2 right-2 h-6 w-6"
                  onClick={() => setNewImage(prev => ({ ...prev, file_data: '' }))}
                >
                  <X className="h-3 w-3" />
                </Button>
              </div>
            ) : (
              <div 
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-border rounded-lg p-8 text-center cursor-pointer hover:border-primary transition-colors"
              >
                {uploadingImage ? (
                  <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent mx-auto" />
                ) : (
                  <>
                    <Upload className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                    <p className="text-muted-foreground">Click to upload or drag and drop</p>
                    <p className="text-xs text-muted-foreground mt-1">PNG, JPG, GIF up to 10MB</p>
                  </>
                )}
              </div>
            )}

            <div className="space-y-2">
              <Label>Title (Optional)</Label>
              <Input
                placeholder="My Image"
                value={newImage.title}
                onChange={(e) => setNewImage({ ...newImage, title: e.target.value })}
                className="text-foreground"
              />
            </div>

            <div className="space-y-2">
              <Label>Description (Optional)</Label>
              <Textarea
                placeholder="Add a description..."
                value={newImage.description}
                onChange={(e) => setNewImage({ ...newImage, description: e.target.value })}
                className="text-foreground"
              />
            </div>

            <div className="space-y-2">
              <Label>Folder (Optional)</Label>
              <Select
                value={newImage.folder_id || "none"}
                onValueChange={(value) => setNewImage({ ...newImage, folder_id: value === "none" ? "" : value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a folder" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No folder</SelectItem>
                  {folders.filter(f => f.id !== 'all').map((folder) => (
                    <SelectItem key={folder.id} value={folder.id}>
                      <div className="flex items-center gap-2">
                        <div className={`h-3 w-3 rounded-full ${folder.color}`} />
                        {folder.name}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <Button 
              onClick={handleAddImage} 
              className="w-full"
              disabled={!newImage.file_data}
            >
              <Upload className="mr-2 h-4 w-4" />
              Upload Image
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Share Dialog */}
      <Dialog open={isShareDialogOpen} onOpenChange={setIsShareDialogOpen}>
        <DialogContent className="bg-background">
          <DialogHeader>
            <DialogTitle>Share Settings</DialogTitle>
            <DialogDescription>
              Control who can access this {sharingItem?.type === 'folder' ? 'folder' : 'item'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {sharingItem?.is_public && sharingItem.share_token ? (
              <>
                <div className="p-4 bg-green-500/10 border border-green-500/20 rounded-lg">
                  <div className="flex items-center gap-2 text-green-600 mb-2">
                    <Unlock className="h-5 w-5" />
                    <span className="font-medium">Public Link Active</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Input 
                      value={`${typeof window !== 'undefined' ? window.location.origin : ''}/share/${sharingItem.share_token}`}
                      readOnly
                      className="text-xs"
                    />
                    <Button 
                      variant="outline" 
                      size="icon"
                      onClick={() => copyShareLink(sharingItem.share_token!)}
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Permission Level</Label>
                  <Select
                    value={sharingItem.share_permission || 'view'}
                    onValueChange={(value) => {
                      handleShare(sharingItem.type, sharingItem.id, true, value)
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="view">
                        <div className="flex items-center gap-2">
                          <Eye className="h-4 w-4" />
                          View only
                        </div>
                      </SelectItem>
                      <SelectItem value="download">
                        <div className="flex items-center gap-2">
                          <Download className="h-4 w-4" />
                          View & Download
                        </div>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <Button 
                  variant="destructive" 
                  className="w-full"
                  onClick={() => handleShare(sharingItem.type, sharingItem.id, false)}
                >
                  <Lock className="mr-2 h-4 w-4" />
                  Make Private
                </Button>
              </>
            ) : (
              <div className="text-center py-4">
                <Lock className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground mb-4">
                  This {sharingItem?.type === 'folder' ? 'folder' : 'item'} is currently private
                </p>
                <Button 
                  className="w-full"
                  onClick={() => sharingItem && handleShare(sharingItem.type, sharingItem.id, true, 'view')}
                >
                  <Share2 className="mr-2 h-4 w-4" />
                  Create Public Link
                </Button>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  )
}
