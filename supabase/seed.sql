-- =============================================================================
-- Percha — Seed de datos de referencia
-- PERCHA-027: Categorías y subcategorías de prendas (PERCHA-009)
-- =============================================================================
-- Este seed es idempotente: ON CONFLICT DO NOTHING evita duplicados al re-ejecutar.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Categorías (8 categorías según PERCHA-009)
-- ---------------------------------------------------------------------------
INSERT INTO categories (nombre, slug) VALUES
  ('Tops',                    'tops'),
  ('Pantalones y Shorts',     'pantalones-y-shorts'),
  ('Vestidos y Faldas',       'vestidos-y-faldas'),
  ('Calzado',                 'calzado'),
  ('Abrigos y Chaquetas',     'abrigos-y-chaquetas'),
  ('Ropa Interior y Pijamas', 'ropa-interior-y-pijamas'),
  ('Accesorios',              'accesorios'),
  ('Otros',                   'otros')
ON CONFLICT (slug) DO NOTHING;


-- ---------------------------------------------------------------------------
-- Subcategorías (por categoría)
-- ---------------------------------------------------------------------------

-- Tops
INSERT INTO subcategories (category_id, nombre, slug)
SELECT c.id, s.nombre, s.slug
FROM categories c
CROSS JOIN (VALUES
  ('Remera',    'remera'),
  ('Camisa',    'camisa'),
  ('Blusa',     'blusa'),
  ('Buzo',      'buzo'),
  ('Musculosa', 'musculosa'),
  ('Polo',      'polo')
) AS s(nombre, slug)
WHERE c.slug = 'tops'
ON CONFLICT (slug) DO NOTHING;

-- Pantalones y Shorts
INSERT INTO subcategories (category_id, nombre, slug)
SELECT c.id, s.nombre, s.slug
FROM categories c
CROSS JOIN (VALUES
  ('Jean',               'jean'),
  ('Pantalón de vestir', 'pantalon-de-vestir'),
  ('Chino',              'chino'),
  ('Short',              'short'),
  ('Jogging',            'jogging')
) AS s(nombre, slug)
WHERE c.slug = 'pantalones-y-shorts'
ON CONFLICT (slug) DO NOTHING;

-- Vestidos y Faldas
INSERT INTO subcategories (category_id, nombre, slug)
SELECT c.id, s.nombre, s.slug
FROM categories c
CROSS JOIN (VALUES
  ('Vestido casual', 'vestido-casual'),
  ('Vestido formal', 'vestido-formal'),
  ('Falda corta',    'falda-corta'),
  ('Falda larga',    'falda-larga')
) AS s(nombre, slug)
WHERE c.slug = 'vestidos-y-faldas'
ON CONFLICT (slug) DO NOTHING;

-- Calzado
INSERT INTO subcategories (category_id, nombre, slug)
SELECT c.id, s.nombre, s.slug
FROM categories c
CROSS JOIN (VALUES
  ('Zapatillas', 'zapatillas'),
  ('Zapatos',    'zapatos'),
  ('Botas',      'botas'),
  ('Sandalias',  'sandalias'),
  ('Mocasines',  'mocasines')
) AS s(nombre, slug)
WHERE c.slug = 'calzado'
ON CONFLICT (slug) DO NOTHING;

-- Abrigos y Chaquetas
INSERT INTO subcategories (category_id, nombre, slug)
SELECT c.id, s.nombre, s.slug
FROM categories c
CROSS JOIN (VALUES
  ('Campera', 'campera'),
  ('Saco',    'saco'),
  ('Blazer',  'blazer'),
  ('Tapado',  'tapado'),
  ('Chaleco', 'chaleco')
) AS s(nombre, slug)
WHERE c.slug = 'abrigos-y-chaquetas'
ON CONFLICT (slug) DO NOTHING;

-- Ropa Interior y Pijamas
INSERT INTO subcategories (category_id, nombre, slug)
SELECT c.id, s.nombre, s.slug
FROM categories c
CROSS JOIN (VALUES
  ('Ropa interior', 'ropa-interior'),
  ('Pijama',        'pijama'),
  ('Medias',        'medias')
) AS s(nombre, slug)
WHERE c.slug = 'ropa-interior-y-pijamas'
ON CONFLICT (slug) DO NOTHING;

-- Accesorios
INSERT INTO subcategories (category_id, nombre, slug)
SELECT c.id, s.nombre, s.slug
FROM categories c
CROSS JOIN (VALUES
  ('Cinturón',  'cinturon'),
  ('Cartera',   'cartera'),
  ('Mochila',   'mochila'),
  ('Bufanda',   'bufanda'),
  ('Gorro',     'gorro'),
  ('Anteojos',  'anteojos'),
  ('Joyería',   'joyeria')
) AS s(nombre, slug)
WHERE c.slug = 'accesorios'
ON CONFLICT (slug) DO NOTHING;

-- Otros
INSERT INTO subcategories (category_id, nombre, slug)
SELECT c.id, s.nombre, s.slug
FROM categories c
CROSS JOIN (VALUES
  ('Otro', 'otro')
) AS s(nombre, slug)
WHERE c.slug = 'otros'
ON CONFLICT (slug) DO NOTHING;
