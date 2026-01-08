import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { format } from 'date-fns'
import { MessageSquare, Send, Upload, X, FileText, Image as ImageIcon, File, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { ScrollArea } from '@/components/ui/scroll-area'
import transactionApi from '@/api/transactions'
import { formatApiError } from '@/utils/errorHandler'

interface TransactionCommentsDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  transactionId: number
}

interface FileAttachment {
  file: File
  preview?: string
}

export function TransactionCommentsDialog({
  open,
  onOpenChange,
  transactionId,
}: TransactionCommentsDialogProps) {
  const queryClient = useQueryClient()
  const [comment, setComment] = useState('')
  const [tags, setTags] = useState<string[]>([])
  const [tagInput, setTagInput] = useState('')
  const [attachments, setAttachments] = useState<FileAttachment[]>([])

  // Fetch comments
  const { data: commentsData, isLoading } = useQuery({
    queryKey: ['transaction-comments', transactionId],
    queryFn: () => transactionApi.getComments(transactionId),
    enabled: open && !!transactionId,
  })

  // Add comment mutation
  const addCommentMutation = useMutation({
    mutationFn: (commentText: string) => transactionApi.addComment(transactionId, commentText),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transaction-comments', transactionId] })
      setComment('')
      setTags([])
      setAttachments([])
      toast.success('Comment added successfully')
    },
    onError: (error: any) => {
      toast.error(formatApiError(error) || 'Failed to add comment')
    },
  })

  const handleAddTag = () => {
    if (tagInput.trim() && !tags.includes(tagInput.trim())) {
      setTags([...tags, tagInput.trim()])
      setTagInput('')
    }
  }

  const handleRemoveTag = (tagToRemove: string) => {
    setTags(tags.filter((tag) => tag !== tagToRemove))
  }

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files
    if (!files) return

    const newAttachments: FileAttachment[] = []
    Array.from(files).forEach((file) => {
      const attachment: FileAttachment = { file }
      
      // Create preview for images
      if (file.type.startsWith('image/')) {
        const reader = new FileReader()
        reader.onloadend = () => {
          attachment.preview = reader.result as string
          setAttachments((prev) => [...prev, attachment])
        }
        reader.readAsDataURL(file)
      } else {
        newAttachments.push(attachment)
      }
    })

    if (newAttachments.length > 0) {
      setAttachments((prev) => [...prev, ...newAttachments])
    }
  }

  const handleRemoveAttachment = (index: number) => {
    setAttachments(attachments.filter((_, i) => i !== index))
  }

  const handleSubmit = () => {
    if (!comment.trim()) {
      toast.error('Please enter a comment')
      return
    }

    // Build comment with tags and file info
    let fullComment = comment.trim()
    
    if (tags.length > 0) {
      fullComment += '\n\nTags: ' + tags.map(tag => `#${tag}`).join(' ')
    }

    if (attachments.length > 0) {
      fullComment += '\n\nAttachments: ' + attachments.map(a => a.file.name).join(', ')
    }

    addCommentMutation.mutate(fullComment)
  }

  const getFileIcon = (fileName: string) => {
    const ext = fileName.split('.').pop()?.toLowerCase()
    if (['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext || '')) {
      return <ImageIcon className="h-4 w-4" />
    }
    if (['pdf'].includes(ext || '')) {
      return <FileText className="h-4 w-4" />
    }
    return <File className="h-4 w-4" />
  }

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B'
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
  }

  const parseCommentTags = (commentText: string) => {
    const tagMatch = commentText.match(/Tags: (.+?)(?:\n|$)/)
    if (tagMatch) {
      return tagMatch[1].split(' ').filter(t => t.startsWith('#'))
    }
    return []
  }

  const getCommentText = (commentText: string) => {
    return commentText.split('\n\nTags:')[0].split('\n\nAttachments:')[0]
  }

  const comments = commentsData?.data || []

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5" />
            Transaction Comments #{transactionId}
          </DialogTitle>
          <DialogDescription>
            Add notes, tags, and attach files to this transaction
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4 h-full">
          {/* Comments List */}
          <ScrollArea className="flex-1 pr-4" style={{ maxHeight: '300px' }}>
            {isLoading ? (
              <div className="text-center py-8 text-muted-foreground">Loading comments...</div>
            ) : comments.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No comments yet. Be the first to add one!
              </div>
            ) : (
              <div className="space-y-4">
                {comments.map((comment) => {
                  const commentTags = parseCommentTags(comment.comment)
                  const commentText = getCommentText(comment.comment)

                  return (
                    <div key={comment.id} className="flex gap-3 p-3 rounded-lg border bg-muted/30">
                      <Avatar className="h-8 w-8">
                        <AvatarFallback className="text-xs">
                          {comment.createdBy?.substring(0, 2).toUpperCase() || 'UN'}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 space-y-2">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-sm">{comment.createdBy || 'Unknown'}</span>
                          <span className="text-xs text-muted-foreground">
                            {format(new Date(comment.createdAt), 'MMM dd, yyyy HH:mm')}
                          </span>
                        </div>
                        <p className="text-sm whitespace-pre-wrap">{commentText}</p>
                        {commentTags.length > 0 && (
                          <div className="flex flex-wrap gap-1">
                            {commentTags.map((tag, idx) => (
                              <Badge key={idx} variant="secondary" className="text-xs">
                                {tag}
                              </Badge>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </ScrollArea>

          {/* Add Comment Form */}
          <div className="space-y-3 border-t pt-4">
            <Textarea
              placeholder="Write a comment..."
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              className="min-h-[80px] resize-none"
            />

            {/* Tags Input */}
            <div className="space-y-2">
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Add tag..."
                  value={tagInput}
                  onChange={(e) => setTagInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      handleAddTag()
                    }
                  }}
                  className="flex-1 px-3 py-2 text-sm rounded-md border bg-background"
                />
                <Button type="button" size="sm" onClick={handleAddTag}>
                  Add Tag
                </Button>
              </div>
              {tags.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {tags.map((tag) => (
                    <Badge key={tag} variant="secondary" className="gap-1">
                      #{tag}
                      <X
                        className="h-3 w-3 cursor-pointer hover:text-destructive"
                        onClick={() => handleRemoveTag(tag)}
                      />
                    </Badge>
                  ))}
                </div>
              )}
            </div>

            {/* File Attachments */}
            <div className="space-y-2">
              <div className="flex gap-2">
                <label className="flex-1">
                  <input
                    type="file"
                    multiple
                    onChange={handleFileSelect}
                    className="hidden"
                    accept="image/*,.pdf,.doc,.docx,.txt"
                  />
                  <Button type="button" variant="outline" size="sm" className="w-full" asChild>
                    <span className="flex items-center gap-2 cursor-pointer">
                      <Upload className="h-4 w-4" />
                      Attach Files
                    </span>
                  </Button>
                </label>
              </div>
              {attachments.length > 0 && (
                <div className="grid grid-cols-2 gap-2">
                  {attachments.map((attachment, index) => (
                    <div
                      key={index}
                      className="flex items-center gap-2 p-2 border rounded-lg bg-muted/30"
                    >
                      {attachment.preview ? (
                        <img
                          src={attachment.preview}
                          alt={attachment.file.name}
                          className="h-10 w-10 rounded object-cover"
                        />
                      ) : (
                        <div className="h-10 w-10 flex items-center justify-center bg-muted rounded">
                          {getFileIcon(attachment.file.name)}
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium truncate">{attachment.file.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {formatFileSize(attachment.file.size)}
                        </p>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        onClick={() => handleRemoveAttachment(index)}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Submit Button */}
            <Button
              onClick={handleSubmit}
              disabled={addCommentMutation.isPending || !comment.trim()}
              className="w-full"
            >
              <Send className="h-4 w-4 mr-2" />
              {addCommentMutation.isPending ? 'Adding...' : 'Add Comment'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
