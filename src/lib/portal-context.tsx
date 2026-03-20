import * as React from "react"

const PortalContext = React.createContext<HTMLElement | null>(null)

export function PortalProvider({
  container,
  children,
}: {
  container: HTMLElement
  children: React.ReactNode
}) {
  return (
    <PortalContext.Provider value={container}>
      {children}
    </PortalContext.Provider>
  )
}

export function usePortalContainer() {
  return React.useContext(PortalContext)
}
