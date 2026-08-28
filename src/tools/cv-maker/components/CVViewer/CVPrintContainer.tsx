import React from 'react'

interface CVPrintContainerProps {
  children: React.ReactNode
}

/**
 * CVPrintContainer: Wraps the CV content inside a ghost-table structure for flawless A4 pagination.
 *
 * How it works:
 * - <thead> with display: table-header-group adds a consistent 12mm top spacer across printed pages.
 * - <tfoot> with display: table-footer-group reserves clean bottom margin across printed pages.
 * - <tbody> contains the entire rendered CV without middle-of-page splitting bugs.
 */
export const CVPrintContainer: React.FC<CVPrintContainerProps> = ({ children }) => {
  return (
    <table className="cv-print-table">
      <thead className="cv-print-header-spacer">
        <tr>
          <td style={{ height: '12mm', border: 'none', padding: 0 }} />
        </tr>
      </thead>
      <tbody className="cv-print-tbody">
        <tr>
          <td className="cv-print-cell">
            {children}
          </td>
        </tr>
      </tbody>
      <tfoot className="cv-print-footer-spacer">
        <tr>
          <td style={{ height: '12mm', border: 'none', padding: 0 }} />
        </tr>
      </tfoot>
    </table>
  )
}
