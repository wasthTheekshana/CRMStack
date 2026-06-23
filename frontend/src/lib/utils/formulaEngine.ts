type TokenType = 'NUMBER' | 'FIELD_REF' | 'OP' | 'LPAREN' | 'RPAREN' | 'FUNC' | 'COMMA'

interface Token {
  type: TokenType
  value: string
}

interface ASTNode {
  type: 'number' | 'field_ref' | 'binary_op' | 'unary_neg' | 'func_call'
  value?: string | number
  op?: string
  left?: ASTNode
  right?: ASTNode
  args?: ASTNode[]
  name?: string
}

const FUNCTIONS = new Set(['ROUND', 'MIN', 'MAX', 'ABS'])

export function tokenize(expr: string): Token[] {
  const tokens: Token[] = []
  let i = 0
  while (i < expr.length) {
    if (/\s/.test(expr[i])) { i++; continue }

    if (expr[i] === '{' && expr[i + 1] === '{') {
      const end = expr.indexOf('}}', i + 2)
      if (end === -1) throw new Error('Unclosed field reference')
      tokens.push({ type: 'FIELD_REF', value: expr.slice(i + 2, end).trim() })
      i = end + 2
      continue
    }

    if (/[0-9.]/.test(expr[i])) {
      let num = ''
      while (i < expr.length && /[0-9.]/.test(expr[i])) { num += expr[i]; i++ }
      tokens.push({ type: 'NUMBER', value: num })
      continue
    }

    if (/[A-Z]/.test(expr[i])) {
      let name = ''
      while (i < expr.length && /[A-Z_]/.test(expr[i])) { name += expr[i]; i++ }
      if (!FUNCTIONS.has(name)) throw new Error(`Unknown function: ${name}`)
      tokens.push({ type: 'FUNC', value: name })
      continue
    }

    if ('+-*/'.includes(expr[i])) {
      tokens.push({ type: 'OP', value: expr[i] })
      i++; continue
    }

    if (expr[i] === '(') { tokens.push({ type: 'LPAREN', value: '(' }); i++; continue }
    if (expr[i] === ')') { tokens.push({ type: 'RPAREN', value: ')' }); i++; continue }
    if (expr[i] === ',') { tokens.push({ type: 'COMMA', value: ',' }); i++; continue }

    throw new Error(`Unexpected character: ${expr[i]}`)
  }
  return tokens
}

export function parse(tokens: Token[]): ASTNode {
  let pos = 0

  function peek(): Token | undefined { return tokens[pos] }
  function consume(): Token { return tokens[pos++] }

  function parseExpr(): ASTNode {
    let left = parseTerm()
    while (peek()?.type === 'OP' && (peek()!.value === '+' || peek()!.value === '-')) {
      const op = consume().value
      const right = parseTerm()
      left = { type: 'binary_op', op, left, right }
    }
    return left
  }

  function parseTerm(): ASTNode {
    let left = parseUnary()
    while (peek()?.type === 'OP' && (peek()!.value === '*' || peek()!.value === '/')) {
      const op = consume().value
      const right = parseUnary()
      left = { type: 'binary_op', op, left, right }
    }
    return left
  }

  function parseUnary(): ASTNode {
    if (peek()?.type === 'OP' && peek()!.value === '-') {
      consume()
      const operand = parsePrimary()
      return { type: 'unary_neg', left: operand }
    }
    return parsePrimary()
  }

  function parsePrimary(): ASTNode {
    const token = peek()
    if (!token) throw new Error('Unexpected end of expression')

    if (token.type === 'NUMBER') {
      consume()
      return { type: 'number', value: parseFloat(token.value) }
    }

    if (token.type === 'FIELD_REF') {
      consume()
      return { type: 'field_ref', value: token.value }
    }

    if (token.type === 'FUNC') {
      const name = consume().value
      if (!peek() || peek()!.type !== 'LPAREN') throw new Error(`Expected ( after ${name}`)
      consume() // (
      const args: ASTNode[] = []
      if (peek()?.type !== 'RPAREN') {
        args.push(parseExpr())
        while (peek()?.type === 'COMMA') {
          consume() // ,
          args.push(parseExpr())
        }
      }
      if (!peek() || peek()!.type !== 'RPAREN') throw new Error(`Expected ) after ${name} arguments`)
      consume() // )
      return { type: 'func_call', name, args }
    }

    if (token.type === 'LPAREN') {
      consume()
      const node = parseExpr()
      if (!peek() || peek()!.type !== 'RPAREN') throw new Error('Missing closing parenthesis')
      consume()
      return node
    }

    throw new Error(`Unexpected token: ${token.value}`)
  }

  const ast = parseExpr()
  if (pos < tokens.length) throw new Error(`Unexpected token: ${tokens[pos].value}`)
  return ast
}

export function evaluate(ast: ASTNode, values: Record<string, number>): number {
  switch (ast.type) {
    case 'number':
      return ast.value as number
    case 'field_ref':
      return values[ast.value as string] ?? 0
    case 'unary_neg':
      return -evaluate(ast.left!, values)
    case 'binary_op': {
      const left = evaluate(ast.left!, values)
      const right = evaluate(ast.right!, values)
      switch (ast.op) {
        case '+': return left + right
        case '-': return left - right
        case '*': return left * right
        case '/': return right === 0 ? 0 : left / right
        default: throw new Error(`Unknown operator: ${ast.op}`)
      }
    }
    case 'func_call': {
      const args = ast.args!.map(a => evaluate(a, values))
      switch (ast.name) {
        case 'ROUND': return parseFloat(args[0].toFixed(args[1] ?? 0))
        case 'ABS':   return Math.abs(args[0])
        case 'MIN':   return Math.min(args[0], args[1])
        case 'MAX':   return Math.max(args[0], args[1])
        default: throw new Error(`Unknown function: ${ast.name}`)
      }
    }
    default:
      throw new Error(`Unknown AST node type: ${ast.type}`)
  }
}

export function evaluateFormula(expr: string, values: Record<string, number>): number {
  const tokens = tokenize(expr)
  const ast = parse(tokens)
  return evaluate(ast, values)
}

export function extractFieldRefs(expr: string): string[] {
  const refs: string[] = []
  const regex = /\{\{([^}]+)\}\}/g
  let match
  while ((match = regex.exec(expr)) !== null) {
    const ref = match[1].trim()
    if (!refs.includes(ref)) refs.push(ref)
  }
  return refs
}
