import {
  evaluateFormula,
  extractFieldRefs,
  detectCircularRefs,
} from '../utils/formulaEngine'

describe('formulaEngine', () => {
  describe('evaluateFormula', () => {
    it('evaluates simple addition', () => {
      expect(evaluateFormula('{{a}} + {{b}}', { a: 10, b: 20 })).toBe(30)
    })

    it('evaluates multiplication', () => {
      expect(evaluateFormula('{{qty}} * {{price}}', { qty: 5, price: 100 })).toBe(500)
    })

    it('respects operator precedence', () => {
      expect(evaluateFormula('{{a}} + {{b}} * {{c}}', { a: 1, b: 2, c: 3 })).toBe(7)
    })

    it('respects parentheses', () => {
      expect(evaluateFormula('({{a}} + {{b}}) * {{c}}', { a: 1, b: 2, c: 3 })).toBe(9)
    })

    it('handles division', () => {
      expect(evaluateFormula('{{a}} / {{b}}', { a: 10, b: 4 })).toBe(2.5)
    })

    it('returns 0 for division by zero', () => {
      expect(evaluateFormula('{{a}} / {{b}}', { a: 10, b: 0 })).toBe(0)
    })

    it('defaults missing fields to 0', () => {
      expect(evaluateFormula('{{a}} + {{b}}', { a: 10 })).toBe(10)
    })

    it('handles nested expressions', () => {
      expect(
        evaluateFormula('({{qty}} * {{price}}) - ({{qty}} * {{price}} * {{discount}} / 100)', {
          qty: 10, price: 100, discount: 15,
        })
      ).toBe(850)
    })

    it('handles numeric literals', () => {
      expect(evaluateFormula('{{a}} * 1.18', { a: 100 })).toBeCloseTo(118)
    })

    it('handles ROUND function', () => {
      expect(evaluateFormula('ROUND({{a}} / 3, 2)', { a: 10 })).toBe(3.33)
    })

    it('handles ABS function', () => {
      expect(evaluateFormula('ABS({{a}} - {{b}})', { a: 3, b: 10 })).toBe(7)
    })

    it('handles MIN function', () => {
      expect(evaluateFormula('MIN({{a}}, {{b}})', { a: 5, b: 3 })).toBe(3)
    })

    it('handles MAX function', () => {
      expect(evaluateFormula('MAX({{a}}, {{b}})', { a: 5, b: 3 })).toBe(5)
    })

    it('throws on invalid syntax', () => {
      expect(() => evaluateFormula('{{a}} +', { a: 1 })).toThrow()
    })

    it('throws on unknown function', () => {
      expect(() => evaluateFormula('SQRT({{a}})', { a: 4 })).toThrow()
    })
  })

  describe('extractFieldRefs', () => {
    it('extracts field references', () => {
      expect(extractFieldRefs('{{cf_qty}} * {{cf_price}}')).toEqual(['cf_qty', 'cf_price'])
    })

    it('returns empty array for no refs', () => {
      expect(extractFieldRefs('42 + 10')).toEqual([])
    })

    it('deduplicates refs', () => {
      expect(extractFieldRefs('{{a}} + {{a}}')).toEqual(['a'])
    })
  })

  describe('detectCircularRefs', () => {
    it('returns null for no cycles', () => {
      expect(detectCircularRefs([
        { id: 'a', formula: '{{b}} + 1' },
        { id: 'b' },
      ])).toBeNull()
    })

    it('detects direct cycle', () => {
      const result = detectCircularRefs([
        { id: 'a', formula: '{{b}} + 1' },
        { id: 'b', formula: '{{a}} + 1' },
      ])
      expect(result).not.toBeNull()
    })

    it('detects indirect cycle', () => {
      const result = detectCircularRefs([
        { id: 'a', formula: '{{b}} + 1' },
        { id: 'b', formula: '{{c}} + 1' },
        { id: 'c', formula: '{{a}} + 1' },
      ])
      expect(result).not.toBeNull()
    })

    it('detects self-reference', () => {
      const result = detectCircularRefs([
        { id: 'a', formula: '{{a}} + 1' },
      ])
      expect(result).not.toBeNull()
    })
  })
})
