// [VexFlow](http://vexflow.com) - Copyright (c) Mohit Muthanna 2010.
// MIT License

import { RuntimeError, log } from './util';
import { Flow } from './flow';
import { Note, NoteStruct } from './note';
import { Stem } from './stem';
import { StaveNote } from './stavenote';
import { Glyph, GlyphProps } from './glyph';
import { RenderContext } from './types/common';
import { BoundingBox } from './boundingbox';
import { Stave } from './stave';
import { ElementStyle } from './element';

// eslint-disable-next-line
function L(...args: any[]) {
  if (NoteHead.DEBUG) log('Vex.Flow.NoteHead', args);
}

export interface NoteHeadStruct extends NoteStruct {
  glyph_font_scale?: number;
  slashed?: boolean;
  style?: ElementStyle;
  stem_down_x_offset?: number;
  stem_up_x_offset?: number;
  custom_glyph_code?: string;
  x_shift?: number;
  line?: number;
  stem_direction?: number;
  displaced?: boolean;
  //  duration: string;
  note_type: string;
  y?: number;
  x?: number;
  index?: number;
}

/**
 * Draw slashnote head manually. No glyph exists for this.
 * @param ctx the Canvas context
 * @param duration the duration of the note. ex: "4"
 * @param x the x coordinate to draw at
 * @param y the y coordinate to draw at
 * @param stem_direction the direction of the stem
 */
function drawSlashNoteHead(
  ctx: RenderContext,
  duration: string,
  x: number,
  y: number,
  stem_direction: number,
  staveSpace: number
) {
  const width = Flow.SLASH_NOTEHEAD_WIDTH;
  ctx.save();
  ctx.setLineWidth(Flow.STEM_WIDTH);

  let fill = false;

  if (Flow.durationToNumber(duration) > 2) {
    fill = true;
  }

  if (!fill) x -= (Flow.STEM_WIDTH / 2) * stem_direction;

  ctx.beginPath();
  ctx.moveTo(x, y + staveSpace);
  ctx.lineTo(x, y + 1);
  ctx.lineTo(x + width, y - staveSpace);
  ctx.lineTo(x + width, y);
  ctx.lineTo(x, y + staveSpace);
  ctx.closePath();

  if (fill) {
    ctx.fill();
  } else {
    ctx.stroke();
  }

  if (Flow.durationToFraction(duration).equals(0.5)) {
    const breve_lines = [-3, -1, width + 1, width + 3];
    for (let i = 0; i < breve_lines.length; i++) {
      ctx.beginPath();
      ctx.moveTo(x + breve_lines[i], y - 10);
      ctx.lineTo(x + breve_lines[i], y + 11);
      ctx.stroke();
    }
  }

  ctx.restore();
}

/**
 * `NoteHeads` are typically not manipulated
 * directly, but used internally in `StaveNote`.
 *
 * See `tests/notehead_tests.ts` for usage examples.
 */
export class NoteHead extends Note {
  /** To enable logging for this class. Set `Vex.Flow.NoteHead.DEBUG` to `true`. */
  static DEBUG: boolean;

  glyph_code: string;

  protected custom_glyph: boolean = false;
  protected stem_up_x_offset: number = 0;
  protected stem_down_x_offset: number = 0;
  protected note_type: string;
  protected displaced: boolean;
  protected stem_direction: number;

  protected x: number;
  protected y: number;
  protected line: number;
  protected index?: number;
  protected slashed: boolean;

  static get CATEGORY(): string {
    return 'notehead';
  }

  constructor(head_options: NoteHeadStruct) {
    super(head_options);
    this.setAttribute('type', 'NoteHead');

    this.index = head_options.index;
    this.x = head_options.x || 0;
    this.y = head_options.y || 0;
    this.note_type = head_options.note_type;
    this.duration = head_options.duration;
    this.displaced = head_options.displaced || false;
    this.stem_direction = head_options.stem_direction || StaveNote.STEM_UP;
    this.line = head_options.line || 0;

    // Get glyph code based on duration and note type. This could be
    // regular notes, rests, or other custom codes.
    this.glyph = Flow.getGlyphProps(this.duration, this.note_type);
    if (!this.glyph) {
      throw new RuntimeError(
        'BadArguments',
        `No glyph found for duration '${this.duration}' and type '${this.note_type}'`
      );
    }

    this.glyph_code = this.glyph.code_head;
    this.x_shift = head_options.x_shift || 0;
    if (head_options.custom_glyph_code) {
      this.custom_glyph = true;
      this.glyph_code = head_options.custom_glyph_code;
      this.stem_up_x_offset = head_options.stem_up_x_offset || 0;
      this.stem_down_x_offset = head_options.stem_down_x_offset || 0;
    }

    this.style = head_options.style;
    this.slashed = head_options.slashed || false;

    this.render_options = {
      ...this.render_options,
      ...{
        // font size for note heads
        glyph_font_scale: head_options.glyph_font_scale || Flow.DEFAULT_NOTATION_FONT_SCALE,
        // number of stroke px to the left and right of head
        stroke_px: 3,
      },
    };

    this.setWidth(this.glyph.getWidth(this.render_options.glyph_font_scale));
  }

  getCategory(): string {
    return NoteHead.CATEGORY;
  }

  /** Get the width of the notehead. */
  getWidth(): number {
    return this.width;
  }

  /** Determine if the notehead is displaced. */
  isDisplaced(): boolean {
    return this.displaced === true;
  }

  /** Get the glyph data. */
  getGlyph(): GlyphProps {
    return this.glyph;
  }

  /** Set the X coordinate. */
  setX(x: number): this {
    this.x = x;
    return this;
  }

  /** Get the Y coordinate. */
  getY(): number {
    return this.y;
  }

  /** Set the Y coordinate. */
  setY(y: number): this {
    this.y = y;
    return this;
  }

  /** Get the stave line the notehead is placed on. */
  getLine(): number {
    return this.line;
  }

  /** Set the stave line the notehead is placed on. */
  setLine(line: number): this {
    this.line = line;
    return this;
  }

  /** Get the canvas `x` coordinate position of the notehead. */
  getAbsoluteX(): number {
    // If the note has not been preformatted, then get the static x value
    // Otherwise, it's been formatted and we should use it's x value relative
    // to its tick context
    const x = !this.preFormatted ? this.x : super.getAbsoluteX();

    // For a more natural displaced notehead, we adjust the displacement amount
    // by half the stem width in order to maintain a slight overlap with the stem
    const displacementStemAdjustment = Stem.WIDTH / 2;
    const fontShift = this.musicFont.lookupMetric('notehead.shiftX', 0) * this.stem_direction;
    const displacedFontShift = this.musicFont.lookupMetric('noteHead.displaced.shiftX', 0) * this.stem_direction;

    return (
      x +
      fontShift +
      (this.displaced ? (this.width - displacementStemAdjustment) * this.stem_direction + displacedFontShift : 0)
    );
  }

  /** Get the `BoundingBox` for the `NoteHead`. */
  getBoundingBox(): BoundingBox {
    if (!this.preFormatted) {
      throw new RuntimeError('UnformattedNote', "Can't call getBoundingBox on an unformatted note.");
    }
    const spacing = this.checkStave().getSpacingBetweenLines();
    const half_spacing = spacing / 2;
    const min_y = this.y - half_spacing;

    return new BoundingBox(this.getAbsoluteX(), min_y, this.width, spacing);
  }

  /** Set notehead to a provided `stave`. */
  setStave(stave: Stave): this {
    const line = this.getLine();

    this.stave = stave;
    if (this.stave) {
      this.setY(this.stave.getYForNote(line));
      this.setContext(this.stave.getContext());
    }
    return this;
  }

  /** Pre-render formatting. */
  preFormat(): this {
    if (this.preFormatted) return this;

    const width = this.getWidth() + this.leftDisplacedHeadPx + this.rightDisplacedHeadPx;

    this.setWidth(width);
    this.setPreFormatted(true);
    return this;
  }

  /** Draw the notehead. */
  draw(): void {
    const ctx = this.checkContext();
    this.setRendered();

    let head_x = this.getAbsoluteX();
    if (this.custom_glyph) {
      // head_x += this.x_shift;
      head_x += this.stem_direction === Stem.UP ? this.stem_up_x_offset : this.stem_down_x_offset;
    }

    const y = this.y;

    L("Drawing note head '", this.note_type, this.duration, "' at", head_x, y);

    // Begin and end positions for head.
    const stem_direction = this.stem_direction;
    const glyph_font_scale = this.render_options.glyph_font_scale;

    if (this.style) {
      this.applyStyle(ctx);
    }

    const categorySuffix = `${this.glyph_code}Stem${stem_direction === Stem.UP ? 'Up' : 'Down'}`;
    if (this.note_type === 's') {
      const staveSpace = this.checkStave().getSpacingBetweenLines();
      drawSlashNoteHead(ctx, this.duration, head_x, y, stem_direction, staveSpace);
    } else {
      Glyph.renderGlyph(ctx, head_x, y, glyph_font_scale, this.glyph_code, {
        font: this.musicFont,
        category: this.custom_glyph ? `noteHead.custom.${categorySuffix}` : `noteHead.standard.${categorySuffix}`,
      });
    }

    if (this.style) {
      this.restoreStyle(ctx);
    }
  }
}
