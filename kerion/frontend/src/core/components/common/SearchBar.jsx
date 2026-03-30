import { useState, useCallback, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { Search, X, Package, ArrowRight, ScanBarcode } from 'lucide-react'
import api from '../../services/api'
import Modal from './Modal'

export default function SearchBar() {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [showModal, setShowModal] = useState(false)
  const [loading, setLoading] = useState(false)
  const inputRef = useRef(null)
  const navigate = useNavigate()
  const debounceRef = useRef(null)

  const search = useCallback(async (q) => {
    if (!q || q.length < 2) {
      setResults([])
      return
    }
    setLoading(true)
    try {
      const { data } = await api.get('/dropscan/dashboard/guias/search', { params: { q } })
      setResults(data.guias || [])
      setShowModal(true)
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
    setShowModal(false)
    inputRef.current?.focus()
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && query.length >= 2) {
      clearTimeout(debounceRef.current)
      search(query)
    }
  }

  const handleResultClick = (guia) => {
    setShowModal(false)
    setQuery('')
    setResults([])
    // Navigate to historial with search params to open the tarima detail and highlight the guide
    navigate(`/dropscan/historial?search=${encodeURIComponent(guia.codigo_guia)}&tarima_id=${guia.tarima_id}&highlight_guia=${encodeURIComponent(guia.codigo_guia)}`)
  }

  return (
    <>
      <div className="relative w-full max-w-md">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-warm-400" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            onFocus={() => query.length >= 2 && results.length > 0 && setShowModal(true)}
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
      </div>

      {/* Results Modal */}
      <Modal
        isOpen={showModal && query.length >= 2}
        onClose={() => setShowModal(false)}
        title={`Resultados para "${query}"`}
        icon={ScanBarcode}
        size="lg"
      >
        {loading ? (
          <div className="p-8 text-center">
            <div className="w-8 h-8 border-3 border-primary-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
            <p className="text-sm text-warm-400">Buscando...</p>
          </div>
        ) : results.length === 0 ? (
          <div className="p-12 text-center">
            <Search className="w-12 h-12 text-warm-200 mx-auto mb-3" />
            <p className="text-sm text-warm-500 font-medium">No se encontraron guías</p>
            <p className="text-xs text-warm-400 mt-1">Intenta con otro código de guía</p>
          </div>
        ) : (
          <div className="space-y-1">
            <p className="text-xs text-warm-400 mb-3 font-medium">{results.length} resultado{results.length !== 1 ? 's' : ''} encontrado{results.length !== 1 ? 's' : ''}</p>
            <div className="max-h-[60vh] overflow-y-auto rounded-xl border border-warm-100">
              {results.map((g, i) => (
                <motion.div
                  key={g.id}
                  initial={{ opacity: 0, y: 5 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.03 }}
                  onClick={() => handleResultClick(g)}
                  className="flex items-center gap-4 px-5 py-4 hover:bg-primary-50/50 cursor-pointer border-b border-warm-50 last:border-b-0 transition-colors group"
                >
                  <div className="w-10 h-10 rounded-xl bg-primary-100 text-primary-600 flex items-center justify-center shrink-0">
                    <Package className="w-5 h-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-mono font-bold text-warm-800">{g.codigo_guia}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-xs text-warm-500">{g.tarima_codigo}</span>
                      <span className="text-warm-300">·</span>
                      <span className="text-xs text-warm-500">{g.empresa_nombre}</span>
                      <span className="text-warm-300">·</span>
                      <span className="text-xs font-semibold text-primary-600">Pos #{g.posicion}</span>
                    </div>
                  </div>
                  <span className={`text-xs px-2.5 py-1 rounded-lg font-semibold ${
                    g.tarima_estado === 'FINALIZADA'
                      ? 'bg-success-100 text-success-700'
                      : g.tarima_estado === 'CANCELADA'
                        ? 'bg-danger-100 text-danger-700'
                        : 'bg-warning-100 text-warning-700'
                  }`}>
                    {g.tarima_estado}
                  </span>
                  <ArrowRight className="w-4 h-4 text-warm-300 group-hover:text-primary-500 transition-colors" />
                </motion.div>
              ))}
            </div>
          </div>
        )}
      </Modal>
    </>
  )
}
