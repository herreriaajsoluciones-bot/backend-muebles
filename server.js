const express = require('express');
const cors = require('cors');
const multer = require('multer');
const { createClient } = require('@supabase/supabase-js');

const app = express();

// Configuración de CORS y middleware
app.use(cors());
app.use(express.json());

// Configuración de Supabase
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

// Multer en memoria para manejar las imágenes recibidas
const upload = multer({ storage: multer.memoryStorage() });

// 1. RUTA GET (Obtener productos)
app.get('/api/muebles', async (req, res) => {
    try {
        const { data, error } = await supabase.from('muebles').select('*');
        if (error) throw error;
        res.json(data);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 2. RUTA POST (Crear producto) -> Esta es la que faltaba y daba 404
app.post('/api/muebles', upload.array('imagenes'), async (req, res) => {
    try {
        const { nombre, categoria, precio, anterior, cuotas, stock, descripcion } = req.body;
        const files = req.files || [];
        const imageUrls = [];

        // Subir cada imagen a Supabase Storage (asegúrate de tener un bucket público llamado "muebles")
        for (const file of files) {
            const fileName = `${Date.now()}-${file.originalname}`;
            const { data, error } = await supabase.storage
                .from('muebles')
                .upload(fileName, file.buffer, { contentType: file.mimetype });

            if (error) throw error;

            // Obtener la URL pública de la imagen
            const { data: publicUrlData } = supabase.storage
                .from('muebles')
                .getPublicUrl(fileName);

            imageUrls.push(publicUrlData.publicUrl);
        }

        // Insertar el producto en la tabla 'muebles' de Supabase
        const { data, error } = await supabase
            .from('muebles')
            .insert([{
                nombre,
                categoria,
                precio: parseFloat(precio),
                anterior: anterior ? parseFloat(anterior) : null,
                cuotas: parseInt(cuotas),
                stock: parseInt(stock),
                descripcion,
                imagenes: imageUrls
            }]);

        if (error) throw error;

        res.status(201).json({ mensaje: "Producto guardado con éxito", data });
    } catch (err) {
        console.error("Error al guardar mueble:", err);
        res.status(500).json({ error: err.message });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Servidor corriendo en puerto ${PORT}`));