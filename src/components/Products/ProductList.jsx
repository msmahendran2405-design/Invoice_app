import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useSettings } from '../../contexts/SettingsContext';
import db, { SHEET_NAMES } from '../../services/googleSheets';
import { Plus, Search, Edit, Trash2, X, Package, RefreshCw, Tag, ChevronDown } from 'lucide-react';
import { formatIndianCurrency } from '../../utils/indianUtils';
import toast from 'react-hot-toast';

const UNITS = ['Piece', 'Unit', 'Hour', 'Day', 'Month', 'Year', 'kg', 'g', 'lb', 'oz', 'L', 'mL', 'Box', 'Pack', 'Set', 'Service'];
const PRODUCT_CATEGORIES = ['General', 'Electronics', 'Software', 'Services', 'Consulting', 'Hardware', 'Food', 'Clothing', 'Other'];

export default function ProductList() {
  const { user, isAdmin } = useAuth();
  const { settings } = useSettings();
  const canManageCatalog = isAdmin || settings.catalog_admin_only !== 'true';
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [showModal, setShowModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [showDeleteModal, setShowDeleteModal] = useState(null);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    name: '', sku: '', description: '', category: 'General', unit: 'Piece',
    price: '', tax_rate: settings.default_tax_rate || '10', stock_qty: '', is_active: 'true',
  });

  useEffect(() => { loadProducts(); }, []);

  const loadProducts = async () => {
    setLoading(true);
    try {
      const data = await db.fetchSheet(SHEET_NAMES.PRODUCTS, true);
      setProducts(data.filter(p => p.id));
    } catch (error) {
      toast.error('Failed to load products');
    } finally {
      setLoading(false);
    }
  };

  const filteredProducts = useMemo(() => {
    return products.filter(p => {
      const matchesSearch = !searchQuery || p.name?.toLowerCase().includes(searchQuery.toLowerCase()) || p.sku?.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesCategory = categoryFilter === 'all' || p.category === categoryFilter;
      return matchesSearch && matchesCategory;
    });
  }, [products, searchQuery, categoryFilter]);

  const openAddModal = () => {
    setEditingProduct(null);
    setForm({ name: '', sku: '', description: '', category: 'General', unit: 'Piece', price: '', tax_rate: settings.default_tax_rate || '10', stock_qty: '', is_active: 'true' });
    setShowModal(true);
  };

  const openEditModal = (product) => {
    setEditingProduct(product);
    setForm({
      name: product.name || '', sku: product.sku || '', description: product.description || '',
      category: product.category || 'General', unit: product.unit || 'Piece',
      price: product.price || '', tax_rate: product.tax_rate || '10',
      stock_qty: product.stock_qty || '', is_active: product.is_active || 'true',
    });
    setShowModal(true);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) { toast.error('Product name is required'); return; }
    if (!form.price || parseFloat(form.price) < 0) { toast.error('Valid price is required'); return; }

    setSaving(true);
    try {
      const now = new Date().toISOString();
      if (editingProduct) {
        await db.updateRow(SHEET_NAMES.PRODUCTS, editingProduct.id, { ...form, updated_at: now });
        toast.success('Product updated');
      } else {
        await db.appendRow(SHEET_NAMES.PRODUCTS, { ...form, created_by: user.id, created_at: now, updated_at: now });
        toast.success('Product added');
      }
      setShowModal(false);
      loadProducts();
    } catch (error) {
      toast.error('Failed to save product');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    try {
      await db.deleteRow(SHEET_NAMES.PRODUCTS, id);
      setProducts(prev => prev.filter(p => p.id !== id));
      setShowDeleteModal(null);
      toast.success('Product deleted');
    } catch (error) {
      toast.error('Failed to delete product');
    }
  };

  const cs = settings.currency_symbol || '₹';

  return (
    <div className="space-y-5">
      {!canManageCatalog && (
        <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl flex items-center justify-between text-amber-800 text-sm">
          <div className="flex items-center gap-2">
            <span className="font-semibold">🔒 Protected Product Catalog:</span>
            <span>Items, services, and base prices are configured by Administrator. You can select them when generating invoices.</span>
          </div>
          <span className="text-xs px-2.5 py-1 bg-amber-200/60 font-semibold rounded-full">View Only</span>
        </div>
      )}

      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3 flex-1">
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Search products & services..." className="input-field pl-10" />
          </div>
          <div className="relative">
            <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)} className="select-field pr-10 min-w-[140px]">
              <option value="all">All Categories</option>
              {PRODUCT_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
            <ChevronDown className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
          </div>
          <button onClick={loadProducts} className="btn-secondary py-2.5 px-3"><RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /></button>
        </div>
        {canManageCatalog ? (
          <button onClick={openAddModal} className="btn-primary"><Plus className="w-4 h-4" /> Add Product / Service</button>
        ) : (
          <div className="text-xs text-gray-400 font-medium px-3 py-2 bg-gray-100 rounded-lg border border-gray-200">
            Admin Managed Catalog
          </div>
        )}
      </div>

      {/* Products Table */}
      <div className="card p-0 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-20"><div className="w-8 h-8 border-4 border-primary-200 border-t-primary-600 rounded-full animate-spin"></div></div>
        ) : filteredProducts.length === 0 ? (
          <div className="text-center py-16">
            <Package className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-700 mb-1">No products found</h3>
            <p className="text-sm text-gray-500 mb-4">{searchQuery ? 'Try different search' : 'Add your first product'}</p>
            {!searchQuery && <button onClick={openAddModal} className="btn-primary"><Plus className="w-4 h-4" /> Add Product</button>}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="table-header">Product</th>
                  <th className="table-header">SKU</th>
                  <th className="table-header">Category</th>
                  <th className="table-header">Price</th>
                  <th className="table-header">Tax</th>
                  <th className="table-header">Stock</th>
                  <th className="table-header">Status</th>
                  <th className="table-header text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredProducts.map((product) => (
                  <tr key={product.id} className="hover:bg-gray-50/50 transition-colors">
                    <td className="table-cell">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-lg bg-amber-100 text-amber-600 flex items-center justify-center">
                          <Package className="w-4 h-4" />
                        </div>
                        <div>
                          <p className="font-medium text-gray-900">{product.name}</p>
                          {product.description && <p className="text-xs text-gray-500 truncate max-w-[200px]">{product.description}</p>}
                        </div>
                      </div>
                    </td>
                    <td className="table-cell text-gray-500 font-mono text-xs">{product.sku || '—'}</td>
                    <td className="table-cell"><span className="badge-info">{product.category || 'General'}</span></td>
                    <td className="table-cell font-semibold text-gray-900">{formatIndianCurrency(product.price, cs)}</td>
                    <td className="table-cell text-gray-500">{product.tax_rate}%</td>
                    <td className="table-cell text-gray-700">{product.stock_qty || '∞'}</td>
                    <td className="table-cell">
                      <span className={product.is_active === 'false' ? 'badge-danger' : 'badge-success'}>
                        {product.is_active === 'false' ? 'Inactive' : 'Active'}
                      </span>
                    </td>
                    <td className="table-cell text-right">
                      {canManageCatalog ? (
                        <div className="flex items-center justify-end gap-1">
                          <button onClick={() => openEditModal(product)} className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg" title="Edit"><Edit className="w-4 h-4" /></button>
                          <button onClick={() => setShowDeleteModal(product.id)} className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg" title="Delete"><Trash2 className="w-4 h-4" /></button>
                        </div>
                      ) : (
                        <span className="text-xs text-gray-400 italic">Locked</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add/Edit Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal-content max-w-lg" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-6 border-b border-gray-100">
              <h3 className="text-lg font-bold text-gray-900">{editingProduct ? 'Edit Product' : 'Add Product'}</h3>
              <button onClick={() => setShowModal(false)} className="p-1 text-gray-400 hover:text-gray-600 rounded"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={handleSave} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Product Name *</label>
                  <input type="text" value={form.name} onChange={e => setForm(prev => ({...prev, name: e.target.value}))} className="input-field" required />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">SKU</label>
                  <input type="text" value={form.sku} onChange={e => setForm(prev => ({...prev, sku: e.target.value}))} className="input-field" placeholder="e.g., PRD-001" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
                  <select value={form.category} onChange={e => setForm(prev => ({...prev, category: e.target.value}))} className="select-field">
                    {PRODUCT_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Price *</label>
                  <input type="number" min="0" step="0.01" value={form.price} onChange={e => setForm(prev => ({...prev, price: e.target.value}))} className="input-field" required />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Tax Rate (%)</label>
                  <input type="number" min="0" step="0.1" value={form.tax_rate} onChange={e => setForm(prev => ({...prev, tax_rate: e.target.value}))} className="input-field" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Unit</label>
                  <select value={form.unit} onChange={e => setForm(prev => ({...prev, unit: e.target.value}))} className="select-field">
                    {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Stock Qty</label>
                  <input type="number" min="0" value={form.stock_qty} onChange={e => setForm(prev => ({...prev, stock_qty: e.target.value}))} className="input-field" placeholder="Leave empty for unlimited" />
                </div>
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                  <textarea value={form.description} onChange={e => setForm(prev => ({...prev, description: e.target.value}))} className="input-field h-20 resize-none" />
                </div>
                <div className="col-span-2 flex items-center gap-2">
                  <input type="checkbox" checked={form.is_active === 'true'} onChange={e => setForm(prev => ({...prev, is_active: e.target.checked ? 'true' : 'false'}))} className="w-4 h-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500" />
                  <label className="text-sm text-gray-700">Active (available for invoicing)</label>
                </div>
              </div>
              <div className="flex gap-3 justify-end pt-2">
                <button type="button" onClick={() => setShowModal(false)} className="btn-secondary">Cancel</button>
                <button type="submit" disabled={saving} className="btn-primary">
                  {saving ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <>{editingProduct ? 'Update' : 'Add'} Product</>}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showDeleteModal && (
        <div className="modal-overlay" onClick={() => setShowDeleteModal(null)}>
          <div className="modal-content max-w-sm p-6" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-bold text-gray-900 mb-2">Delete Product?</h3>
            <p className="text-sm text-gray-500 mb-6">This will not affect existing invoices.</p>
            <div className="flex gap-3 justify-end">
              <button onClick={() => setShowDeleteModal(null)} className="btn-secondary">Cancel</button>
              <button onClick={() => handleDelete(showDeleteModal)} className="btn-danger">Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
