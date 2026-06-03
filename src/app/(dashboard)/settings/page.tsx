'use client'

import { useState } from 'react'
import { Topbar } from '@/components/layout/Topbar'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { toast } from 'sonner'
import {
  Mail, KeyRound, User, Bell, Shield, ChevronRight,
  Copy, Eye, EyeOff, Check
} from 'lucide-react'

const TABS = [
  { id: 'profile', label: 'Profile', icon: User },
  { id: 'email', label: 'Email Sending', icon: Mail },
  { id: 'api', label: 'API Keys', icon: KeyRound },
  { id: 'notifications', label: 'Notifications', icon: Bell },
]

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState('profile')
  const [showKey, setShowKey] = useState<Record<string, boolean>>({})
  const [copied, setCopied] = useState<string | null>(null)

  // Profile
  const [displayName, setDisplayName] = useState('')
  const [companyName, setCompanyName] = useState('')

  // Email
  const [fromName, setFromName] = useState(process.env.NEXT_PUBLIC_FROM_NAME || '')
  const [fromEmail, setFromEmail] = useState('')

  const handleCopy = (key: string, value: string) => {
    navigator.clipboard.writeText(value)
    setCopied(key)
    setTimeout(() => setCopied(null), 2000)
    toast.success('Copied to clipboard')
  }

  const toggleShowKey = (key: string) => {
    setShowKey(prev => ({ ...prev, [key]: !prev[key] }))
  }

  const maskKey = (key: string) => {
    if (!key) return '••••••••••••••••••••'
    return key.substring(0, 6) + '••••••••••••' + key.substring(key.length - 4)
  }

  const apiKeys = [
    {
      id: 'resend',
      label: 'Resend API Key',
      description: 'Used to send outreach emails via Resend',
      docs: 'https://resend.com/api-keys',
      placeholder: 're_••••••••••••••••••••',
    },
    {
      id: 'openrouter',
      label: 'OpenRouter API Key',
      description: 'Powers AI email generation via OpenRouter',
      docs: 'https://openrouter.ai/keys',
      placeholder: 'sk-or-••••••••••••••••••••',
    },
    {
      id: 'supabase_url',
      label: 'Supabase Project URL',
      description: 'Your Supabase project URL',
      docs: 'https://supabase.com/dashboard',
      placeholder: 'https://your-project.supabase.co',
    },
  ]

  return (
    <div className="animate-fade-in-up">
      <Topbar title="Settings" subtitle="Manage your account, email configuration, and API credentials." />

      <div className="p-6 flex gap-6">
        {/* Tab Sidebar */}
        <div className="w-52 flex-shrink-0">
          <nav className="space-y-1">
            {TABS.map(tab => {
              const Icon = tab.icon
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-left transition-all ${
                    activeTab === tab.id
                      ? 'bg-primary/10 text-primary'
                      : 'text-muted-foreground hover:bg-accent hover:text-foreground'
                  }`}
                >
                  <Icon className="w-4 h-4 flex-shrink-0" />
                  {tab.label}
                </button>
              )
            })}
          </nav>
        </div>

        {/* Content */}
        <div className="flex-1 max-w-2xl">
          {/* Profile Tab */}
          {activeTab === 'profile' && (
            <div className="glass-card rounded-2xl border border-border p-6 space-y-6">
              <div>
                <h2 className="text-lg font-semibold">Profile Settings</h2>
                <p className="text-sm text-muted-foreground mt-1">Update your display name and company details.</p>
              </div>

              <div className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="display-name">Display Name</Label>
                  <Input
                    id="display-name"
                    value={displayName}
                    onChange={e => setDisplayName(e.target.value)}
                    placeholder="Your name"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="company-name">Company Name</Label>
                  <Input
                    id="company-name"
                    value={companyName}
                    onChange={e => setCompanyName(e.target.value)}
                    placeholder="Acme Corp"
                  />
                </div>
              </div>

              <Button onClick={() => toast.success('Profile updated!')}>
                Save Profile
              </Button>
            </div>
          )}

          {/* Email Tab */}
          {activeTab === 'email' && (
            <div className="glass-card rounded-2xl border border-border p-6 space-y-6">
              <div>
                <h2 className="text-lg font-semibold">Email Sending Configuration</h2>
                <p className="text-sm text-muted-foreground mt-1">Configure sender details used in outreach emails.</p>
              </div>

              <div className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="from-name">From Name</Label>
                  <Input
                    id="from-name"
                    value={fromName}
                    onChange={e => setFromName(e.target.value)}
                    placeholder="Your Company"
                  />
                  <p className="text-xs text-muted-foreground">Displayed as the sender name in emails.</p>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="from-email">From Email</Label>
                  <Input
                    id="from-email"
                    type="email"
                    value={fromEmail}
                    onChange={e => setFromEmail(e.target.value)}
                    placeholder="hello@yourcompany.com"
                  />
                  <p className="text-xs text-muted-foreground">Must be a verified domain in your Resend account.</p>
                </div>
              </div>

              <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-4 text-sm text-amber-600 dark:text-amber-400">
                <p className="font-medium mb-1">⚠️ Configuration Note</p>
                <p className="text-xs">Email credentials are configured in your <code className="bg-muted px-1 rounded">.env.local</code> file. 
                Update <code className="bg-muted px-1 rounded">RESEND_FROM_NAME</code> and <code className="bg-muted px-1 rounded">RESEND_FROM_EMAIL</code> there.</p>
              </div>

              <Button onClick={() => toast.success('Settings saved!')}>
                Save Configuration
              </Button>
            </div>
          )}

          {/* API Keys Tab */}
          {activeTab === 'api' && (
            <div className="space-y-4">
              <div className="glass-card rounded-2xl border border-border p-6">
                <h2 className="text-lg font-semibold">API Key Configuration</h2>
                <p className="text-sm text-muted-foreground mt-1">
                  These keys are stored securely in your <code className="bg-muted px-1 rounded text-xs">.env.local</code> file and never exposed to the client.
                </p>
              </div>

              {apiKeys.map(key => (
                <div key={key.id} className="glass-card rounded-2xl border border-border p-5 space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h3 className="font-medium">{key.label}</h3>
                      <p className="text-sm text-muted-foreground mt-0.5">{key.description}</p>
                    </div>
                    <a
                      href={key.docs}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-primary hover:underline flex items-center gap-1 flex-shrink-0"
                    >
                      Get key <ChevronRight className="w-3 h-3" />
                    </a>
                  </div>

                  <div className="flex items-center gap-2">
                    <div className="flex-1 font-mono text-sm bg-muted/50 border border-border rounded-lg px-3 py-2 text-muted-foreground">
                      {showKey[key.id] ? key.placeholder : maskKey('')}
                    </div>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => toggleShowKey(key.id)}
                      title={showKey[key.id] ? 'Hide' : 'Show'}
                    >
                      {showKey[key.id] ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => handleCopy(key.id, key.placeholder)}
                      title="Copy"
                    >
                      {copied === key.id ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
                    </Button>
                  </div>

                  <p className="text-xs text-muted-foreground">
                    Set as <code className="bg-muted px-1 rounded">{
                      key.id === 'resend' ? 'RESEND_API_KEY' :
                      key.id === 'openrouter' ? 'OPENROUTER_API_KEY' :
                      'NEXT_PUBLIC_SUPABASE_URL'
                    }</code> in your .env.local file
                  </p>
                </div>
              ))}

              <div className="glass-card rounded-2xl border border-border p-5 bg-primary/5">
                <div className="flex items-center gap-2 mb-2">
                  <Shield className="w-4 h-4 text-primary" />
                  <span className="font-medium text-sm">Security Notice</span>
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  API keys are never stored in the database or exposed to the browser. They are only accessible server-side through environment variables. Never commit your <code className="bg-muted px-1 rounded">.env.local</code> file to version control.
                </p>
              </div>
            </div>
          )}

          {/* Notifications Tab */}
          {activeTab === 'notifications' && (
            <div className="glass-card rounded-2xl border border-border p-6 space-y-6">
              <div>
                <h2 className="text-lg font-semibold">Notification Preferences</h2>
                <p className="text-sm text-muted-foreground mt-1">Control which notifications you receive.</p>
              </div>

              <div className="space-y-4">
                {[
                  { id: 'campaign_sent', label: 'Campaign sent confirmation', desc: 'Get notified when a campaign finishes sending' },
                  { id: 'campaign_failed', label: 'Campaign send failures', desc: 'Get alerted when emails fail to deliver' },
                  { id: 'new_lead', label: 'New lead imported', desc: 'Notification when CSV import completes' },
                  { id: 'weekly_summary', label: 'Weekly summary', desc: 'A weekly digest of your outreach activity' },
                ].map(item => (
                  <label
                    key={item.id}
                    className="flex items-center justify-between p-4 rounded-xl border border-border hover:bg-accent/30 transition-colors cursor-pointer"
                  >
                    <div>
                      <div className="font-medium text-sm">{item.label}</div>
                      <div className="text-xs text-muted-foreground mt-0.5">{item.desc}</div>
                    </div>
                    <input
                      type="checkbox"
                      defaultChecked={item.id !== 'weekly_summary'}
                      className="w-4 h-4 accent-primary"
                    />
                  </label>
                ))}
              </div>

              <Button onClick={() => toast.success('Preferences saved!')}>
                Save Preferences
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
