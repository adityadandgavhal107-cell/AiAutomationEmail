'use client'

import { useEffect, useState } from 'react'
import { Topbar } from '@/components/layout/Topbar'
import { type Product } from '@/types'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Plus, Package, Edit2, Trash2, Loader2, Calendar, FileText } from 'lucide-react'
import { toast } from 'sonner'
import { formatDate, truncate } from '@/lib/utils'

export default function ProductsPage() {
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)

  // Dialog State
  const [open, setOpen] = useState(false)
  const [editingProduct, setEditingProduct] = useState<Product | null>(null)
  const [submitting, setSubmitting] = useState(false)

  // Form State
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')

  const fetchProducts = async () => {
    setLoading(true)
    try {
      const response = await fetch('/api/products')
      if (!response.ok) throw new Error('Failed to fetch products')
      const result = await response.json()
      setProducts(result.data || [])
    } catch (err) {
      toast.error('Failed to load products.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchProducts()
  }, [])

  const handleOpenCreate = () => {
    setEditingProduct(null)
    setName('')
    setDescription('')
    setOpen(true)
  }

  const handleOpenEdit = (product: Product) => {
    setEditingProduct(product)
    setName(product.name)
    setDescription(product.description || '')
    setOpen(true)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return

    setSubmitting(true)
    try {
      const url = editingProduct ? `/api/products/${editingProduct.id}` : '/api/products'
      const method = editingProduct ? 'PATCH' : 'POST'

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, description }),
      })

      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Failed to save product')

      toast.success(editingProduct ? 'Product updated successfully.' : 'Product created successfully.')
      setOpen(false)
      fetchProducts()
    } catch (err: any) {
      toast.error(err.message || 'Could not save product.')
    } finally {
      setSubmitting(false)
    }
  }

  const handleDelete = async (productId: string) => {
    if (!confirm('Are you sure you want to delete this product?')) return

    try {
      const response = await fetch(`/api/products/${productId}`, {
        method: 'DELETE',
      })

      if (!response.ok) throw new Error('Failed to delete product')

      toast.success('Product deleted successfully.')
      fetchProducts()
    } catch (err) {
      toast.error('Could not delete product.')
    }
  }

  return (
    <div className="animate-fade-in-up">
      <Topbar title="Products & Services" subtitle="Manage descriptions of products or services you are promoting.">
        <Button onClick={handleOpenCreate} className="flex items-center gap-2">
          <Plus className="w-4 h-4" />
          <span>New Product</span>
        </Button>
      </Topbar>

      <div className="p-6">
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {Array.from({ length: 3 }).map((_, idx) => (
              <Card key={idx} className="border-border/50 bg-card/40">
                <CardHeader>
                  <div className="w-8 h-8 rounded bg-muted animate-pulse mb-3" />
                  <div className="h-5 w-2/3 bg-muted animate-pulse mb-2" />
                  <div className="h-4 w-1/2 bg-muted animate-pulse" />
                </CardHeader>
                <CardContent className="space-y-2">
                  <div className="h-3 w-full bg-muted animate-pulse" />
                  <div className="h-3 w-full bg-muted animate-pulse" />
                  <div className="h-3 w-3/4 bg-muted animate-pulse" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : products.length === 0 ? (
          <div className="flex flex-col items-center justify-center border border-dashed border-border rounded-2xl p-16 text-center max-w-xl mx-auto mt-10 bg-card/20">
            <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center text-primary mb-4">
              <Package className="w-6 h-6" />
            </div>
            <h3 className="font-semibold text-lg text-foreground">No products added yet</h3>
            <p className="text-sm text-muted-foreground mt-2 max-w-sm">
              Add details about the products or services you want to sell. Our AI agents will analyze these descriptions to personalize campaigns for each lead.
            </p>
            <Button onClick={handleOpenCreate} className="mt-6 flex items-center gap-2">
              <Plus className="w-4 h-4" />
              <span>Add Your First Product</span>
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {products.map((product) => (
              <Card key={product.id} className="group relative flex flex-col justify-between border-border/50 bg-card/60 hover:bg-card/90 transition-all duration-300 hover:shadow-lg hover:border-primary/20 overflow-hidden">
                <div className="absolute inset-x-0 top-0 h-1.5 bg-gradient-to-r from-primary to-purple-600 opacity-0 group-hover:opacity-100 transition-opacity" />
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
                      <Package className="w-4 h-4" />
                    </div>
                    <div className="flex items-center gap-1 font-mono text-[10px] text-muted-foreground bg-muted/50 px-2 py-0.5 rounded border border-border/30">
                      <Calendar className="w-3 h-3" />
                      <span>{formatDate(product.created_at)}</span>
                    </div>
                  </div>
                  <CardTitle className="text-lg font-bold mt-4 leading-tight group-hover:text-primary transition-colors">
                    {product.name}
                  </CardTitle>
                </CardHeader>
                <CardContent className="pb-6 flex-1">
                  <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-line">
                    {truncate(product.description, 180)}
                  </p>
                </CardContent>
                <CardFooter className="border-t border-border/40 pt-4 bg-muted/20 flex justify-end gap-2 shrink-0">
                  <Button variant="ghost" size="sm" onClick={() => handleOpenEdit(product)} className="h-8 flex items-center gap-1.5 text-xs">
                    <Edit2 className="w-3.5 h-3.5" />
                    <span>Edit</span>
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => handleDelete(product.id)} className="h-8 flex items-center gap-1.5 text-xs text-destructive hover:bg-destructive/10 hover:text-destructive">
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Delete</span>
                  </Button>
                </CardFooter>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Create / Edit Dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>{editingProduct ? 'Edit Product' : 'Add Product Details'}</DialogTitle>
            <DialogDescription>
              Provide details of the product or service. The AI will extract selling points to customize emails.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <Label htmlFor="prod-name">Product / Service Name *</Label>
              <Input
                id="prod-name"
                placeholder="e.g. Acme Sales Copilot"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
            
            <div className="space-y-1.5">
              <Label htmlFor="prod-desc">Detailed Description (For AI Training) *</Label>
              <Textarea
                id="prod-desc"
                placeholder="Describe your product's key value propositions, target audience, pricing plans, and competitive advantages in detail. The more context you provide, the better the AI can personalize email copies."
                rows={6}
                required
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="resize-none"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" type="button" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={submitting}>
                {submitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  'Save Product'
                )}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
