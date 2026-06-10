import Papa from 'papaparse'
import * as XLSX from 'xlsx'
import { type Lead } from '@/types'

export interface CsvRow {
  email?: string
  Email?: string
  'Email ID'?: string
  first_name?: string
  'First Name'?: string
  FirstName?: string
  middle_name?: string
  'Middle Name'?: string
  MiddleName?: string
  last_name?: string
  'Last Name'?: string
  LastName?: string
  organization_name?: string
  'Organization Name'?: string
  OrganizationName?: string
  organization_title?: string
  'Organization Title'?: string
  OrganizationTitle?: string
  organization_department?: string
  'Organization Department'?: string
  OrganizationDepartment?: string
  Department?: string
}

export interface ParsedLead {
  email: string
  first_name: string | null
  middle_name: string | null
  last_name: string | null
  organization_name: string | null
  organization_title: string | null
  organization_department: string | null
}

export interface ParseResult {
  leads: ParsedLead[]
  errors: string[]
  total: number
}

function getField(row: CsvRow, ...keys: string[]): string | null {
  for (const key of keys) {
    const val = (row as Record<string, string>)[key]
    if (val && val.trim()) {
      const cleaned = val.trim()
      // Ignore placeholders like NULL, NULLEMAIL, NULL1, NULLORG2, etc.
      if (!/^NULL(EMAIL|ORG\d*|\d*)?$/i.test(cleaned)) {
        return cleaned
      }
    }
  }
  return null
}

export async function parseCsvFile(file: File): Promise<ParseResult> {
  const fileName = file.name.toLowerCase()
  const leads: ParsedLead[] = []
  const errors: string[] = []
  let total = 0

  try {
    if (fileName.endsWith('.json')) {
      const text = await file.text()
      let rawData: any = JSON.parse(text)
      if (!Array.isArray(rawData)) {
        rawData = [rawData]
      }
      total = rawData.length

      rawData.forEach((row: any, idx: number) => {
        const email = getField(row, 'email', 'Email', 'EMAIL', 'Email ID', 'E-mail 1 - Value')
        if (!email || !email.includes('@')) {
          errors.push(`Row ${idx + 2}: Invalid or missing email`)
          return
        }

        leads.push({
          email,
          first_name: getField(row, 'first_name', 'First Name', 'FirstName', 'first name'),
          middle_name: getField(row, 'middle_name', 'Middle Name', 'MiddleName'),
          last_name: getField(row, 'last_name', 'Last Name', 'LastName', 'last name'),
          organization_name: getField(row, 'organization_name', 'Organization Name', 'OrganizationName', 'Company', 'company'),
          organization_title: getField(row, 'organization_title', 'Organization Title', 'Title', 'Job Title'),
          organization_department: getField(row, 'organization_department', 'Organization Department', 'Department'),
        })
      })
    } else if (fileName.endsWith('.xlsx') || fileName.endsWith('.xls')) {
      const arrayBuffer = await file.arrayBuffer()
      const buffer = Buffer.from(arrayBuffer)
      const workbook = XLSX.read(buffer, { type: 'buffer' })
      const firstSheetName = workbook.SheetNames[0]
      const worksheet = workbook.Sheets[firstSheetName]

      // Read all rows as raw arrays first so we can find the real header row
      const rawRows = XLSX.utils.sheet_to_json<any[]>(worksheet, { header: 1 })


      // Known email column names (case-insensitive check)
      const EMAIL_HEADERS = ['email', 'email id', 'emailid', 'e-mail', 'e-mail 1 - value']

      // Find the first row that contains a recognisable email header
      let headerRowIndex = -1
      for (let i = 0; i < rawRows.length; i++) {
        const row = rawRows[i]
        if (Array.isArray(row) && row.some((cell: any) => EMAIL_HEADERS.includes(String(cell ?? '').toLowerCase().trim()))) {
          headerRowIndex = i
          break
        }
      }

      if (headerRowIndex === -1) {
        errors.push('Could not find a header row with an email column (tried "Email", "Email ID", etc.)')
      } else {
        // Re-parse starting from the detected header row
        const headers: string[] = rawRows[headerRowIndex].map((h: any) => String(h ?? '').trim())
        const dataRows = rawRows.slice(headerRowIndex + 1)
        total = dataRows.length

        dataRows.forEach((cells: any[], idx: number) => {
          // Skip entirely empty rows
          if (!Array.isArray(cells) || cells.every((c: any) => c == null || String(c).trim() === '')) return

          // Build a key→value object using the detected headers
          const row: Record<string, string> = {}
          headers.forEach((h, i) => { row[h] = String(cells[i] ?? '').trim() })

          const email = getField(row as any, 'email', 'Email', 'EMAIL', 'Email ID', 'E-mail 1 - Value')
          if (!email || !email.includes('@')) {
            errors.push(`Row ${headerRowIndex + idx + 2}: Invalid or missing email`)
            return
          }

          leads.push({
            email,
            first_name: getField(row as any, 'first_name', 'First Name', 'FirstName', 'first name'),
            middle_name: getField(row as any, 'middle_name', 'Middle Name', 'MiddleName'),
            last_name: getField(row as any, 'last_name', 'Last Name', 'LastName', 'last name'),
            organization_name: getField(row as any, 'organization_name', 'Organization Name', 'OrganizationName', 'Company', 'company'),
            organization_title: getField(row as any, 'organization_title', 'Organization Title', 'Title', 'Job Title'),
            organization_department: getField(row as any, 'organization_department', 'Organization Department', 'Department'),
          })
        })
      }

    } else {
      const text = await file.text()
      const results = await new Promise<any>((resolve) => {
        Papa.parse<CsvRow>(text, {
          header: true,
          skipEmptyLines: true,
          complete: resolve,
          error: (error: any) => resolve({ data: [], errors: [{ message: error.message }] }),
        })
      })

      if (results.errors && results.errors.length > 0 && results.data.length === 0) {
        errors.push(results.errors[0].message || 'CSV Parsing Error')
      } else {
        total = results.data.length
        results.data.forEach((row: any, idx: number) => {
          const email = getField(row, 'email', 'Email', 'EMAIL', 'Email ID', 'E-mail 1 - Value')
          if (!email || !email.includes('@')) {
            errors.push(`Row ${idx + 2}: Invalid or missing email`)
            return
          }

          leads.push({
            email,
            first_name: getField(row, 'first_name', 'First Name', 'FirstName', 'first name'),
            middle_name: getField(row, 'middle_name', 'Middle Name', 'MiddleName'),
            last_name: getField(row, 'last_name', 'Last Name', 'LastName', 'last name'),
            organization_name: getField(row, 'organization_name', 'Organization Name', 'OrganizationName', 'Company', 'company'),
            organization_title: getField(row, 'organization_title', 'Organization Title', 'Title', 'Job Title'),
            organization_department: getField(row, 'organization_department', 'Organization Department', 'Department'),
          })
        })
      }
    }
  } catch (err: any) {
    errors.push(`File parsing failed: ${err.message}`)
  }

  return { leads, errors, total }
}
