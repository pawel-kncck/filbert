'use client'

import { QRCodeSVG } from 'qrcode.react'

type Props = {
  url: string
  ksefReference: string
}

export function KsefQrCode({ url, ksefReference }: Props) {
  return (
    <div className="flex flex-col items-center gap-2">
      <QRCodeSVG value={url} size={120} level="M" />
      <p className="text-xs text-zinc-500">{ksefReference}</p>
    </div>
  )
}
