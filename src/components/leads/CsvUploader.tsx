'use client'

import { useState, useCallback } from 'react'
import { useDropzone } from 'react-dropzone'
import { UploadCloud, FileText, CheckCircle2, AlertTriangle, X } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Progress } from '@/components/ui/progress'

interface CsvUploaderProps {
  onImportComplete: () => void
}

export function CsvUploader({ onImportComplete }: CsvUploaderProps) {
  const [open, setOpen] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [progress, setProgress] = useState(0)
  const [result, setResult] = useState<{
    imported: number
    skipped: number
    errors: string[]
  } | null>(null)

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    const file = acceptedFiles[0]
    if (!file) return

    const isCsv = file.type === 'text/csv' || file.name.endsWith('.csv')
    const isExcel = file.name.endsWith('.xlsx') || file.name.endsWith('.xls') || file.type === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' || file.type === 'application/vnd.ms-excel'
    const isJson = file.name.endsWith('.json') || file.type === 'application/json'

    if (!isCsv && !isExcel && !isJson) {
      toast.error('Please upload a valid CSV, Excel, or JSON file.')
      return
    }

    setUploading(true)
    setProgress(20)
    setResult(null)

    try {
      const formData = new FormData()
      formData.append('file', file)

      setProgress(50)

      const response = await fetch('/api/leads/import', {
        method: 'POST',
        body: formData,
      })

      setProgress(80)

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to import file.')
      }

      setResult({
        imported: data.imported,
        skipped: data.skipped,
        errors: data.errors || [],
      })

      setProgress(100)
      toast.success(`Successfully imported ${data.imported} leads!`)
      onImportComplete()
    } catch (err: any) {
      toast.error(err.message || 'An error occurred during import.')
      setUploading(false)
      setProgress(0)
    } finally {
      setUploading(false)
    }
  }, [onImportComplete])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    maxFiles: 1,
    multiple: false,
    disabled: uploading,
  })

  const resetState = () => {
    setUploading(false)
    setProgress(0)
    setResult(null)
  }

  return (
    <Dialog open={open} onOpenChange={(val) => {
      setOpen(val)
      if (!val) resetState()
    }}>
      <DialogTrigger render={<Button variant="outline" className="flex items-center gap-2" />}>
        <UploadCloud className="w-4 h-4" />
        <span>Import Leads</span>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Import Leads (CSV, Excel, JSON)</DialogTitle>
          <DialogDescription>
            Upload a CSV, Excel, or JSON file containing your leads. We support fields like email, first_name, last_name, company, title, and department.
          </DialogDescription>
        </DialogHeader>

        {!result ? (
          <div className="space-y-4 py-4">
            <div
              {...getRootProps()}
              className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all ${
                isDragActive
                  ? 'border-primary bg-primary/5'
                  : uploading
                  ? 'border-border bg-muted/20 cursor-not-allowed'
                  : 'border-border hover:border-primary/45 hover:bg-muted/10'
              }`}
            >
              <input {...getInputProps()} />
              <div className="flex flex-col items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                  <UploadCloud className="w-6 h-6" />
                </div>
                <div className="space-y-1">
                  <p className="text-sm font-semibold">
                    {isDragActive ? 'Drop the file here' : 'Drag & drop your file here (CSV, Excel, JSON)'}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    or click to browse from your computer
                  </p>
                </div>
              </div>
            </div>

            {uploading && (
              <div className="space-y-2">
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>Uploading and parsing...</span>
                  <span>{progress}%</span>
                </div>
                <Progress value={progress} className="h-1.5" />
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-4 py-4">
            <div className="flex items-start gap-3 p-4 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-xl">
              <CheckCircle2 className="w-5 h-5 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-foreground">Import Complete</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Successfully imported <span className="font-semibold text-emerald-400">{result.imported}</span> leads.
                  {result.skipped > 0 && ` Skipped ${result.skipped} rows due to invalid emails.`}
                </p>
              </div>
            </div>

            {result.errors.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-xs font-semibold text-amber-500">
                  <AlertTriangle className="w-4 h-4" />
                  <span>Parsing Errors ({result.errors.length})</span>
                </div>
                <div className="max-h-32 overflow-y-auto rounded-lg border border-border bg-muted/30 p-2 text-xs font-mono space-y-1 text-muted-foreground">
                  {result.errors.map((err, i) => (
                    <div key={i} className="flex gap-2">
                      <span className="text-amber-500/70 shrink-0">•</span>
                      <span>{err}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2">
              <Button onClick={() => setOpen(false)}>Done</Button>
              <Button variant="outline" onClick={resetState}>
                Upload Another
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
