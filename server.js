const express = require('express');
const { exec } = require('child_process');
const fs = require('fs').promises;
const path = require('path');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Health check endpoint
app.get('/', (req, res) => {
  res.json({ status: 'OpenSCAD API is running' });
});

// Generate keyring preview with multiple angles
app.post('/api/generate-preview', async (req, res) => {
  const params = req.body;
  const angle = req.body.camera_angle || 'default'; // default, top, side, front
  console.log('Received request with params:', params, 'angle:', angle);

  const timestamp = Date.now();
  const scadFile = `/tmp/keyring_${timestamp}.scad`;
  const pngFile = `/tmp/keyring_${timestamp}.png`;

  try {
    // Build OpenSCAD file content with exact parameters
    const scadContent = `
// PARAMETRIC NAME KEYRING - Generated from API
/* [Text & Font] */
font_number      = ${params.font_number || 2};
font_size        = ${params.font_size || 18};
text_line1       = "${params.text_line1 || 'Name'}";
two_line_mode    = ${params.two_line_mode || false};
text_line2       = "${params.text_line2 || 'Name2'}";
line_spacing     = ${params.line_spacing || 30};
text_spacing_mul = ${params.text_spacing_mul || 1.00};
x_shift          = ${params.x_shift || 0};
y_shift          = ${params.y_shift || 0};

/* [Base & Top] */
base_thickness   = ${params.base_thickness || 6};
top_text_height  = ${params.top_text_height || 1.5};
border_offset_r  = ${params.border_offset_r || 1.8};

/* [Loop] */
loop_enable      = ${params.loop_enable !== false};
loop_outer_d     = ${params.loop_outer_d || 10};
loop_hole_d      = ${params.loop_hole_d || 6};
loop_embed_ratio = ${params.loop_embed_ratio || 0.50};
loop_v_align     = "${params.loop_v_align || 'bottom'}";
loop_x_nudge     = ${params.loop_x_nudge || -2};
loop_y_nudge     = ${params.loop_y_nudge || 5};

/* [Colors] */
base_color_name  = "${params.base_color_name || 'black'}";
top_color_name   = "${params.top_color_name || 'orange'}";

// Color definitions for OpenSCAD rendering
function get_base_color() = 
    (base_color_name == "black")  ? [0.1, 0.1, 0.1] :
    (base_color_name == "white")  ? [0.95, 0.95, 0.95] :
    (base_color_name == "red")    ? [0.8, 0.1, 0.1] :
    (base_color_name == "blue")   ? [0.1, 0.3, 0.8] :
    (base_color_name == "green")  ? [0.1, 0.6, 0.2] :
    (base_color_name == "yellow") ? [0.9, 0.9, 0.1] :
    (base_color_name == "orange") ? [0.9, 0.5, 0.1] :
                                    [0.1, 0.1, 0.1]; // default black

function get_top_color() = 
    (top_color_name == "white")  ? [0.95, 0.95, 0.95] :
    (top_color_name == "black")  ? [0.1, 0.1, 0.1] :
    (top_color_name == "red")    ? [0.8, 0.1, 0.1] :
    (top_color_name == "blue")   ? [0.1, 0.3, 0.8] :
    (top_color_name == "green")  ? [0.1, 0.6, 0.2] :
    (top_color_name == "yellow") ? [0.9, 0.9, 0.1] :
    (top_color_name == "orange") ? [0.9, 0.5, 0.1] :
                                   [0.95, 0.95, 0.95]; // default white

// Helper functions
function font_name(n) =
    (n==1) ? "Anton:style=Regular" :
    (n==2) ? "Chewy:style=Regular" :
    (n==3) ? "Montserrat:style=Black" :
    (n==4) ? "Poppins:style=Black" :
             "Liberation Sans:style=Bold";

function text_h() = two_line_mode ? (line_spacing + font_size) : font_size;

function loop_y_cen() =
    (loop_v_align=="top")    ? -(text_h() - loop_outer_d)/2 :
    (loop_v_align=="bottom") ? +(text_h() - loop_outer_d)/2 :
                               -text_h()/2;

// Text geometry
module textline2d(txt){
    text(txt, font=font_name(font_number), size=font_size,
         halign="left", valign="baseline", spacing=text_spacing_mul);
}

module flat_text_2d(){
    textline2d(text_line1);
    if (two_line_mode) translate([0,-line_spacing]) textline2d(text_line2);
}

module outline_text_2d(){
    if (border_offset_r > 0) offset(r=border_offset_r) flat_text_2d();
    else flat_text_2d();
}

// Base with loop
module base2d_with_loop(){
    left_edge = -border_offset_r;
    x_center  = left_edge - (loop_outer_d/2) + loop_outer_d*loop_embed_ratio + loop_x_nudge;
    y_center  = loop_y_cen() + loop_y_nudge;
    if (loop_enable) {
        difference(){
            union(){
                outline_text_2d();
                translate([x_center, y_center]) circle(d=loop_outer_d, $fn=64);
            }
            translate([x_center, y_center]) circle(d=loop_hole_d, $fn=64);
        }
    } else {
        outline_text_2d();
    }
}

// Main model
module nameplate(){
    translate([-x_shift, -y_shift, 0]){
        color(get_base_color())
        linear_extrude(height=base_thickness)
            base2d_with_loop();
        
        color(get_top_color())
        translate([0,0,base_thickness])
            linear_extrude(height=top_text_height)
                flat_text_2d();
    }
}

// Render
nameplate();
`;

    // Write SCAD file
    await fs.writeFile(scadFile, scadContent);
    console.log('SCAD file created:', scadFile);

    // Camera angles configuration - Default to TOP view with clean background
    let cameraParams = '--camera=0,0,150,0,0,0,0'; // Top-down view
    let colorScheme = '--colorscheme=Cornfield'; // Better contrast than Tomorrow
    
    switch(angle) {
      case 'top':
        // Top-down view to see text clearly
        cameraParams = '--camera=0,0,150,0,0,0,0';
        break;
      case 'side':
        // Side view to see thickness and layers
        cameraParams = '--camera=100,0,20,0,0,0,0';
        break;
      case 'front':
        // Front view
        cameraParams = '--camera=0,100,20,0,0,0,0';
        break;
      case 'angle':
        // Angled 3/4 view
        cameraParams = '--camera=70,50,50,0,0,0,0';
        break;
      default:
        // Default TOP view (same as top)
        cameraParams = '--camera=0,0,150,0,0,0,0';
    }

    // Execute OpenSCAD to generate PNG with better color rendering
    const openscadCommand = `openscad --export-format=png ${scadFile} -o ${pngFile} ${cameraParams} --imgsize=800,600 ${colorScheme} --render`;
    
    console.log('Executing OpenSCAD with camera:', angle);
    
    exec(openscadCommand, async (error, stdout, stderr) => {
      if (error) {
        console.error('OpenSCAD error:', error);
        console.error('stderr:', stderr);
        
        try {
          await fs.unlink(scadFile);
        } catch (e) {}
        
        return res.status(500).json({ 
          error: 'Failed to generate preview',
          details: stderr || error.message 
        });
      }

      console.log('OpenSCAD output:', stdout);

      try {
        const imageBuffer = await fs.readFile(pngFile);
        
        await fs.unlink(scadFile);
        await fs.unlink(pngFile);
        
        res.contentType('image/png');
        res.send(imageBuffer);
        
        console.log('Preview sent successfully');
      } catch (readError) {
        console.error('Error reading PNG:', readError);
        res.status(500).json({ error: 'Failed to read generated image' });
      }
    });

  } catch (err) {
    console.error('Server error:', err);
    res.status(500).json({ error: 'Internal server error', details: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`OpenSCAD API server running on port ${PORT}`);
});
