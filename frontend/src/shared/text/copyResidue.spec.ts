import { describe, expect, it } from 'vitest'

import { removeCopyResidue } from './copyResidue'

describe('removeCopyResidue', () => {
  it('removes only the contracted residues and converts NBSP to an ASCII space', () => {
    expect(removeCopyResidue('A\u200BB\u00ADC\u00A0D\uFEFFE\u200CF\u200DG')).toBe('ABC DE\u200CF\u200DG')
  })

  it('does not remove literal ASCII hyphens', () => {
    expect(removeCopyResidue('state-of-the-art')).toBe('state-of-the-art')
  })
})
