const express = require('express');
const cors = require('cors');
const multer = require('multer');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const app = express();
const upload = multer({ storage: multer.memoryStorage() });

// Cliente de Supabase
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

// Middleware
app.use(cors({ origin: process.env.FRONTEND_URL || '*' }));
app.use(express.json());

// ==========================================
// 1. ENDPOINT PÚBLICO: Obtener todos los muebles
// ==========================================
app.get('/api/muebles', async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('muebles')
            .select('*')
            .order('id', { ascending: true });

        if (error) throw error;
        res.json(data);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ==========================================
// 2. ENDPOINT ADMIN: Login de Administrador
// ==========================================
app.post('/api/admin/login', async (req, res) => {
    const { email, password } = req.body;

    try {
        const { data, error } = await supabase.auth.signInWithPassword({
            email,
            password
        });

        if (error) return res.status(401).json({ error: 'Credenciales inválidas' });

        res.json({
            message: 'Login exitoso',
            token: data.session.access_token,
            user: data.user
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ==========================================
// 3. ENDPOINT ADMIN: Crear Mueble + Subir Fotos a Storage
// ==========================================
app.post('/api/admin/muebles', upload.array('imagenes', 5), async (req, res) => {
    try {
        const token = req.headers.authorization?.split(' ')[1];
        if (!token) return res.status(401).json({ error: 'No autorizado' });

        // Validar sesión en Supabase
        const { data: userData, error: authError } = await supabase.auth.getUser(token);
        if (authError || !userData.user) {
            return res.status(401).json({ error: 'Token inválido o expirado' });
        }

        const {
            nombre, categoria, anterior, precio, descuento,
            cuotas, valor_cuota, vendidos, stock, descripcion, caracteristicas
        } = req.body;

        const imagenesUrls = [];

        // Subir cada imagen a Supabase Storage
        if (req.files && req.files.length > 0) {
            for (const file of req.files) {
                const filename = `mueble-${Date.now()}-${Math.round(Math.random() * 1e9)}.${file.mimetype.split('/')[1]}`;

                const { data: uploadData, error: uploadError } = await supabase.storage
                    .from('muebles-fotos')
                    .upload(filename, file.buffer, {
                        contentType: file.mimetype
                    });

                if (uploadError) throw uploadError;

                // Obtener la URL pública del archivo subido
                const { data: urlData } = supabase.storage
                    .from('muebles-fotos')
                    .getPublicUrl(filename);

                imagenesUrls.push(urlData.publicUrl);
            }
        }

        // Insertar mueble en la base de datos
        const { data: nuevoMueble, error: dbError } = await supabase
            .from('muebles')
            .insert([{
                nombre,
                categoria,
                imagenes: imagenesUrls,
                anterior: Number(anterior) || 0,
                precio: Number(precio),
                descuento: Number(descuento) || 0,
                cuotas: Number(cuotas) || 1,
                valor_cuota: Number(valor_cuota) || Number(precio),
                vendidos: vendidos || 'Nuevo',
                stock: Number(stock) || 1,
                descripcion,
                caracteristicas: typeof caracteristicas === 'string' ? JSON.parse(caracteristicas) : caracteristicas
            }])
            .select();

        if (dbError) throw dbError;

        res.status(201).json({
            message: 'Mueble creado correctamente',
            mueble: nuevoMueble[0]
        });

    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Servidor corriendo en puerto ${PORT}`));