import { useState, useCallback, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { Search, X, Package, ArrowRight } from 'lucide-react'
import api from '../../services/api'

export default function SearchBar() {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const inputRef = useRef(null)
  const wrapperRef = useRef(null)
  const navigate = useNavigate()
  const debounceRef = useRef(null)

  // Close dropdown on outside click
  useEffect(() => {
    const handleClick = (e) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  const search = useCallback(async (q) => {
    if (!q || q.length < 2) {
      setResults([])
      setOpen(false)
      return
    }
    setLoading(true)
    setOpen(true)
    try {
      const { data } = await api.get('/dropscan/dashboard/guias/search', { params: { q } })
      setResults(data.guias || [])
    } catch (e) {
      setResults([])
    } finally {
      setLoading(false)
    }
  }, [])

  const handleChange = (e) => {
    const val = e.target.value
    setQuery(val)
    clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => search(val), 300)
  }

  const handleClear = () => {
    setQuery('')
    setResults([])
    setOpen(false)
    inputRef.current?.focus()
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && query.length >= 2) {
      clearTimeout(debounceRef.current)
      search(query)
    }
    if (e.key === 'Escape') setOpen(false)
  }

  const handleResultClick = (guia) => {
    setOpen(false)
    setQuery('')
    setResults([])
    navigate(`/dropscan/historial?search=${encodeURIComponent(guia.codigo_guia)}&tarima_id=${guia.tarima_id}&highlight_guia=${encodeURIComponent(guia.codigo_guia)}`)
  }

  return (
    <div ref={wrapperRef} className="relative w-full max-w-[538px]">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-warm-400" />
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          onFocus={() => query.length >= 2 && results.length > 0 && setOpen(true)}
          placeholder="Buscar guía..."
          className="w-full pl-10 pr-10 py-2 text-sm bg-warm-50 border border-warm-200 rounded-xl
                     focus:bg-white focus:border-primary-400 focus:ring-2 focus:ring-primary-100
                     transition-all outline-none placeholder:text-warm-400"
        />
        {query && (
          <button onClick={handleClear} className="absolute right-3 top-1/2 -translate-y-1/2">
            <X className="w-4 h-4 text-warm-400 hover:text-warm-600" />
          </button>
        )}
      </div>

      {/* Dropdown results panel */}
      <AnimatePresence>
        {open && query.length >= 2 && (
          <motion.div
            initial={{ opacity: 0, y: -4, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.98 }}
            transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
            className="absolute top-full left-0 mt-2 z-50 w-[120%] bg-white/95 backdrop-blur-xl rounded-xl shadow-depth border border-warm-100 overflow-hidden"
          >
            {loading ? (
              <div className="p-6 text-center">
                <div className="w-6 h-6 border-2 border-primary-500 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                <p className="text-xs text-warm-400">搜索中...</p>
              </div>
            ) : results.length === 0 ? (
              <div className="p-6 text-center">
                <Search className="w-8 h-8 text-warm-200 mx-auto mb-2" />
                <p className="text-xs text-warm-500 font-medium">未找到运单</p>
              </div>
            ) : (
              <div>
                <div className="px-4 py-2 border-b border-warm-100 bg-warm-50/50">
                  <p className="text-[10px] text-warm-400 font-bold uppercase tracking-wider">
                    {results.length} 条结果
                  </p>
                </div>
                <div className="max-h-72 overflow-y-auto scrollbar-thin">
                  {results.map((g, i) => (
                    <motion.div
                      key={g.id}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: i * 0.02 }}
                      onMouseDown={(e) => { e.preventDefault(); handleResultClick(g) }}
                      className="px-4 py-3 hover:bg-primary-50/50 cursor-pointer border-b border-warm-50 last:border-b-0 transition-colors group"
                    >
                      <div className="flex items-start justify-between gap-2 mb-1.5">
                        <p className="text-sm font-mono font-bold text-warm-800 leading-tight">{g.codigo_guia}</p>
                        <ArrowRight className="w-3.5 h-3.5 text-warm-300 group-hover:text-primary-500 transition-colors shrink-0 mt-0.5" />
                      </div>
                      <div className="flex items-center gap-1 text-[10px] text-warm-500 mb-1.5">
                        <Package className="w-3 h-3 shrink-0" />
                        <span>{g.tarima_codigo}</span>
                        {g.folio_asignado && (
                          <>
                            <span className="text-warm-300">·</span>
                            <span className="font-medium text-accent-600">{g.folio_asignado}</span>
                          </>
                        )}
                        <span className="text-warm-300">·</span>
                        <span>位置 #{g.posicion}</span>
                      </div>
                      {(() => {
                        const ds = g.folio_asignado ? 'ENVIADA' : g.tarima_estado
                        const clr = ds === 'ENVIADA'
                          ? 'bg-accent-100 text-accent-700'
                          : ds === 'FINALIZADA'
                            ? 'bg-success-100 text-success-700'
                            : ds === 'CANCELADA'
                              ? 'bg-danger-100 text-danger-700'
                              : 'bg-warning-100 text-warning-700'
                        const label = ds === 'ENVIADA' ? 'Enviada' : ds
                        return (
                          <span className={`badge text-[10px] ${clr}`}>{label}</span>
                        )
                      })()}
                    </motion.div>
                  ))}
                </div>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
