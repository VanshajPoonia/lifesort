"use client"

import { useEffect, useState } from "react"
import { useParams } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { 
  Folder, 
  ExternalLink, 
  ImageIcon, 
  Link as LinkIcon, 
  Download,
  User,
  Lock,
  Globe,
  Calendar,
} from "lucide-react"

interface SharedFolder {
  id: number
  name: string
  color: string
  owner_name: string
  share_permission: string
  created_at: string
}

interface SharedLink {
  id: number
  title: string
  url: string
  description: string
  image_url: string
  link_type: string
  file_data: string
  owner_name: string
  share_permission: string
  created_at: string
}

export default function SharePage() {
  const params = useParams()
  const token = params.token as string
  
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [folder, setFolder] = useState<SharedFolder | null>(null)
  const [links, setLinks] = useState<SharedLink[]>([])
  const [singleLink, setSingleLink] = useState<SharedLink | null>(null)
  const [permission, setPermission] = useState<string>("view")

  useEffect(() => {
    fetchSharedContent()
  }, [token])

  const fetchSharedContent = async () => {
    setLoading(true)
    try {
      // Try folder first
      let response = await fetch(`/api/share?token=${token}&type=folder`)
      if (response.ok) {
        const data = await response.json()
        setFolder(data.folder)
        setLinks(data.links || [])
        setPermission(data.permission)
        setLoading(false)
        return
      }

      // Try single link
      response = await fetch(`/api/share?token=${token}&type=link`)
      if (response.ok) {
        const data = await response.json()
        setSingleLink(data.link)
        setPermission(data.permission)
        setLoading(false)
        return
      }

      setError("This content is not available or has been made private.")
    } catch (err) {
      setError("Failed to load shared content")
    }
    setLoading(false)
  }

  const handleDownload = (link: SharedLink) => {
    if (permission !== "download" && permission !== "edit") {
      alert("Download not permitted for this content")
      return
    }
    
    if (link.file_data) {
      const a = document.createElement("a")
      a.href = link.file_data
      a.download = link.title || "download"
      a.click()
    } else if (link.url) {
      window.open(link.url, "_blank")
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent mx-auto mb-4" />
          <p className="text-muted-foreground">Loading shared content...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Card className="max-w-md w-full mx-4">
          <CardContent className="pt-6 text-center">
            <Lock className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h2 className="text-xl font-semibold mb-2">Content Not Available</h2>
            <p className="text-muted-foreground">{error}</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  // Single link/image view
  if (singleLink) {
    return (
      <div className="min-h-screen bg-background">
        <div className="max-w-4xl mx-auto p-6">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  {singleLink.link_type === "image" ? (
                    <ImageIcon className="h-5 w-5" />
                  ) : (
                    <LinkIcon className="h-5 w-5" />
                  )}
                  {singleLink.title || "Shared Content"}
                </CardTitle>
                <Badge variant="outline" className="gap-1">
                  <Globe className="h-3 w-3" />
                  {permission}
                </Badge>
              </div>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <User className="h-4 w-4" />
                Shared by {singleLink.owner_name}
                <span className="mx-2">•</span>
                <Calendar className="h-4 w-4" />
                {new Date(singleLink.created_at).toLocaleDateString()}
              </div>
            </CardHeader>
            <CardContent>
              {singleLink.link_type === "image" || singleLink.file_data ? (
                <div className="space-y-4">
                  <div className="rounded-lg overflow-hidden border border-border">
                    <img 
                      src={singleLink.file_data || singleLink.image_url || singleLink.url} 
                      alt={singleLink.title}
                      className="w-full h-auto max-h-[70vh] object-contain bg-muted"
                    />
                  </div>
                  {(permission === "download" || permission === "edit") && (
                    <Button onClick={() => handleDownload(singleLink)} className="w-full">
                      <Download className="mr-2 h-4 w-4" />
                      Download Image
                    </Button>
                  )}
                </div>
              ) : (
                <div className="space-y-4">
                  {singleLink.image_url && (
                    <img 
                      src={singleLink.image_url || "/placeholder.svg"} 
                      alt={singleLink.title}
                      className="w-full h-48 object-cover rounded-lg"
                    />
                  )}
                  {singleLink.description && (
                    <p className="text-muted-foreground">{singleLink.description}</p>
                  )}
                  <Button asChild className="w-full">
                    <a href={singleLink.url} target="_blank" rel="noopener noreferrer">
                      <ExternalLink className="mr-2 h-4 w-4" />
                      Open Link
                    </a>
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  // Folder view
  if (folder) {
    return (
      <div className="min-h-screen bg-background">
        <div className="max-w-6xl mx-auto p-6">
          <Card className="mb-6">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-3">
                  <div className={`h-10 w-10 rounded-lg ${folder.color} flex items-center justify-center`}>
                    <Folder className="h-5 w-5 text-white" />
                  </div>
                  {folder.name}
                </CardTitle>
                <Badge variant="outline" className="gap-1">
                  <Globe className="h-3 w-3" />
                  {permission}
                </Badge>
              </div>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <User className="h-4 w-4" />
                Shared by {folder.owner_name}
                <span className="mx-2">•</span>
                {links.length} items
              </div>
            </CardHeader>
          </Card>

          {links.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <Folder className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">This folder is empty</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {links.map((link) => (
                <Card key={link.id} className="overflow-hidden hover:shadow-lg transition-shadow">
                  {(link.link_type === "image" || link.file_data) ? (
                    <div className="aspect-video bg-muted relative group">
                      <img 
                        src={link.file_data || link.image_url || link.url} 
                        alt={link.title}
                        className="w-full h-full object-cover"
                      />
                      {(permission === "download" || permission === "edit") && (
                        <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                          <Button 
                            variant="secondary" 
                            size="sm"
                            onClick={() => handleDownload(link)}
                          >
                            <Download className="mr-2 h-4 w-4" />
                            Download
                          </Button>
                        </div>
                      )}
                    </div>
                  ) : link.image_url ? (
                    <div className="aspect-video bg-muted">
                      <img 
                        src={link.image_url || "/placeholder.svg"} 
                        alt={link.title}
                        className="w-full h-full object-cover"
                      />
                    </div>
                  ) : (
                    <div className="aspect-video bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center">
                      <LinkIcon className="h-12 w-12 text-muted-foreground" />
                    </div>
                  )}
                  <CardContent className="p-4">
                    <h3 className="font-medium truncate">{link.title || "Untitled"}</h3>
                    {link.description && (
                      <p className="text-sm text-muted-foreground line-clamp-2 mt-1">
                        {link.description}
                      </p>
                    )}
                    {link.url && link.link_type !== "image" && (
                      <Button variant="outline" size="sm" asChild className="mt-3 w-full bg-transparent">
                        <a href={link.url} target="_blank" rel="noopener noreferrer">
                          <ExternalLink className="mr-2 h-3 w-3" />
                          Open Link
                        </a>
                      </Button>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>
    )
  }

  return null
}
