import Papa from 'papaparse'
import { type Lead } from '@/types'

export interface CsvRow {
  email?: string
  Email?: string
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
    if (val && val.trim()) return val.trim()
  }
  return null
}

export function parseCsvFile(file: File): Promise<ParseResult> {
  return new Promise((resolve) => {
    Papa.parse<CsvRow>(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        const leads: ParsedLead[] = []
        const errors: string[] = []

        results.data.forEach((row, idx) => {
          const email = getField(row, 'email', 'Email', 'EMAIL')
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

        resolve({ leads, errors, total: results.data.length })
      },
      error: (error) => {
        resolve({ leads: [], errors: [error.message], total: 0 })
      },
    })
  })
}
