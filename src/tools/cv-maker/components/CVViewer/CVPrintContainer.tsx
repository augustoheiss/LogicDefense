import React from 'react'

interface CVPrintContainerProps {
  children: React.ReactNode
}

/**
 * CVPrintContainer: Clean document wrapper for flawless A4 pagination and on-screen preview.
 */
export const CVPrintContainer: React.FC<CVPrintContainerProps> = ({ children }) => {
  return (
    <div className="cv-print-wrapper">
      {children}
    </div>
  )
}
