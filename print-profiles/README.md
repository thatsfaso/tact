# Print profiles

Ready-made slicer settings for Tact pages, so nothing has to be worked out by
hand. Import the one that matches your slicer, select it, and print.

The values are not arbitrary. Braille dots are domes under a millimetre tall, so
they live or die by layer height: at the usual 0.2 mm a dot is four layers and
comes out stepped and shallow, while at 0.12 mm it is eight and reads as a dome
under a fingertip. Everything else here is ordinary.

## What these profiles set

| Setting | Value | Why |
|---|---|---|
| Layer height | 0.12 mm | a dot is 8 layers instead of 4, so it feels round |
| First layer height | 0.2 mm | sticks reliably without flattening the page |
| Perimeters | 3 | the dot walls are the dot; thin walls collapse |
| Top layers | 5 | dots sit on the top surface and need it solid |
| Infill | 15 % | the page is a thin plate, more is wasted plastic |
| Supports | off | domes are self-supporting, supports would ruin them |
| Brim | 5 mm | rounded corners have less to hold onto |
| Print speed | 40 mm/s | slower gives cleaner small features |

## Files

| File | Slicer |
|---|---|
| `tact-orcaslicer.json` | OrcaSlicer, Bambu Studio |
| `tact-prusaslicer.ini` | PrusaSlicer, SuperSlicer |
| `tact-cura.curaprofile` | UltiMaker Cura |

## Importing

**OrcaSlicer or Bambu Studio.** File, Import, Import Configs, then pick the
`.json`. It appears in the process dropdown as "Tact Braille page".

**PrusaSlicer or SuperSlicer.** File, Import, Import Config, then pick the
`.ini`. Switch to Expert mode if the profile does not appear.

**Cura.** Preferences, Configure Cura, Profiles, Import, then pick the
`.curaprofile`.

## After importing

Load the `.stl`, leave the page flat on the plate, do not rotate or scale it,
and slice. If the first layer will not stick, raise the bed temperature by
five degrees rather than changing anything else.

## Materials

Start with **PLA**. It is cheap and forgiving, and it tells you whether the
settings are right before you spend a difficult filament on it.

Move to **PETG** once that works. It survives handling and does not soften in a
warm room, which matters for something a child will hold repeatedly.

**TPU** is the best of the three to touch, since the page bends instead of
snapping, but it is the hardest to print. Leave it until the other two have
worked. With TPU, drop the speed to 20 mm/s and turn retraction down.

These profiles are tuned for PLA and PETG at a 0.4 mm nozzle. TPU needs the
speed change above.
