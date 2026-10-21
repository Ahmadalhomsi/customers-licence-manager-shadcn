"use client"

import { Suspense, useEffect, useState } from "react"
import { useSearchParams } from "next/navigation"
import Image from "next/image"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Check, Loader2 } from "lucide-react"

// Query parameters the assistant sends; all are passed back to the API unchanged
const AUTHORIZE_PARAMS = ["client_id", "redirect_uri", "response_type", "code_challenge", "code_challenge_method", "state", "scope"]

const ALLOWED_ACTIONS = [
  "Aylık lisans ve yenileme rakamlarını görme",
  "Müşteri ve lisans arama, kalan gün sayısını görme",
  "Lisans uzatma",
  "Lisansı pasife alma, arşivleme ve geri alma",
]

function AuthorizeForm() {
  const searchParams = useSearchParams()
  const params = Object.fromEntries(AUTHORIZE_PARAMS.map((key) => [key, searchParams.get(key) || ""]))

  const [client, setClient] = useState(null)
  const [requestError, setRequestError] = useState(null)
  const [username, setUsername] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState(null)
  const [submitting, setSubmitting] = useState(null)

  useEffect(() => {
    const query = new URLSearchParams(params).toString()
    fetch(`/api/oauth/authorize?${query}`)
      .then(async (response) => {
        const data = await response.json()
        if (response.ok) setClient(data)
        else setRequestError(data.error)
      })
      .catch(() => setRequestError("Sunucuya ulaşılamadı. Bağlantınızı kontrol edip sayfayı yenileyin."))
    // Parameters come from the URL and do not change while the page is open
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const submit = async (decision) => {
    setSubmitting(decision)
    setError(null)
    try {
      const response = await fetch("/api/oauth/authorize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...params, decision, username, password }),
      })
      const data = await response.json()
      if (response.ok && data.redirect) {
        window.location.assign(data.redirect)
        return
      }
      setError(data.error || "Bağlanılamadı. Lütfen tekrar deneyin.")
    } catch {
      setError("Sunucuya ulaşılamadı. Bağlantınızı kontrol edip tekrar deneyin.")
    }
    setSubmitting(null)
  }

  if (requestError) {
    return (
      <Alert variant="destructive">
        <AlertDescription>{requestError}</AlertDescription>
      </Alert>
    )
  }

  if (!client) {
    return (
      <div className="flex justify-center py-10" aria-busy="true" aria-label="Yükleniyor">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <form
      className="flex flex-col gap-5"
      onSubmit={(event) => {
        event.preventDefault()
        submit("allow")
      }}
    >
      <div className="flex flex-col gap-2">
        <p className="text-sm">
          <span className="font-medium">{client.clientName}</span> hesabınızla şunları yapabilecek:
        </p>
        <ul className="flex flex-col gap-1.5 text-sm text-muted-foreground">
          {ALLOWED_ACTIONS.map((action) => (
            <li key={action} className="flex items-start gap-2">
              <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden />
              {action}
            </li>
          ))}
        </ul>
        <p className="text-xs text-muted-foreground">
          Yapılan her değişiklik sizin adınıza kaydedilir. Yetkileriniz panelde neyse asistanda da aynıdır.
        </p>
      </div>

      <div className="flex flex-col gap-3">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="username">Kullanıcı adı</Label>
          <Input id="username" autoComplete="username" value={username} onChange={(e) => setUsername(e.target.value)} required autoFocus />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="password">Şifre</Label>
          <Input id="password" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
        </div>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button type="button" variant="outline" disabled={submitting !== null} onClick={() => submit("deny")}>
          {submitting === "deny" && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Reddet
        </Button>
        <Button type="submit" disabled={submitting !== null}>
          {submitting === "allow" && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Giriş yap ve izin ver
        </Button>
      </div>

      <p className="text-center text-xs text-muted-foreground">Onaydan sonra {client.redirectHost} adresine dönülecek.</p>
    </form>
  )
}

export default function AuthorizePage() {
  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="gap-1">
          <div className="mb-2 flex items-center gap-2">
            <Image src="/MAPOS_LOGO.png" alt="" width={28} height={28} className="rounded-md" />
            <span className="font-semibold text-primary">MAPOS</span>
          </div>
          <CardTitle>Asistanı bağla</CardTitle>
          <CardDescription>Lisans yönetimine erişim için giriş yapın</CardDescription>
        </CardHeader>
        <CardContent>
          <Suspense fallback={null}>
            <AuthorizeForm />
          </Suspense>
        </CardContent>
      </Card>
    </div>
  )
}
