//
// PARAMETRIC NAME KEYRING — Loop fused to base (OpenSCAD 2021+)
// Slice color change at Z = base_thickness.
//

/* [Text & Font] */
// 1=Anton, 2=Chewy, 3=Montserrat Black, 4=Poppins Black, 5=System Default
font_number      = 2;
font_size        = 18;
text_line1       = "Name";
two_line_mode    = false;   // [true:false]
text_line2       = "Name2";
line_spacing     = 30;
text_spacing_mul = 1.00;
x_shift = 0;   // manual centering shift
x_shift = 0;   // move left/right (+ = left)
y_shift = 0;   // move up/down (+ = up)


/* [Base & Top] */
base_thickness   = 6;       // base (first color)
top_text_height  = 1.5;     // raised text (second color)
border_offset_r  = 1.8;     // outline radius; 0 = none
x_shift          = 0;       // manual centering shift

/* [Loop — appended to base 2D] */
loop_enable      = true;    // [true:false]
loop_outer_d     = 10;      // outside diameter
loop_hole_d      = 6;       // hole diameter
loop_embed_ratio = 0.50;    // 0..1 (0.5 = half inside the base)
loop_v_align     = "bottom"; // [center:top:bottom]
loop_x_nudge     = -2;      // mm (fine adjust; + moves right)
loop_y_nudge     = 5;       // mm (fine adjust; + moves up)

/* [Preview Colors] */
base_color_name  = "black";
top_color_name   = "orange";

// ---------------- helpers ----------------
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

// ------------- text geometry -------------
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

// Base 2D + loop (hole cut), then extrude
module base2d_with_loop(){
    left_edge = -border_offset_r; // text starts at x=0; outline grows left
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

// --------------- model ----------------
module nameplate(){
    translate([-x_shift, -y_shift, 0]){
        color(base_color_name)
        linear_extrude(height=base_thickness)
            base2d_with_loop();

        color(top_color_name)
        translate([0,0,base_thickness])
            linear_extrude(height=top_text_height)
                flat_text_2d();
    }
}

// --------------- render ----------------
nameplate();
