import React from 'react'

interface CVPrintContainerProps {
  children: React.ReactNode
}

/**
 * CVPrintContainer: Clean document wrapper for flawless A4 pagination and on-screen preview.
 */
export const CVPrintContainer: React.FC<CVPrintContainerProps> = ({ children }) => {
  return (
    <div id="cv-printable-document" className="cv-print-wrapper" data-cv-engine="p3">
      {children}
    </div>
  )
}
