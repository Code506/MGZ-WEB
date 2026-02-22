# Home Electrical Layout Designer

A lightweight 3D web app for planning a home's electrical layout by placing receptacles, light fixtures, and appliance plugs inside a customizable room shell.

## Features

- Create a room shell by width, depth, and wall height.
- Place different component types on floor or walls:
  - 120V receptacles
  - 240V receptacles
  - Ceiling lights
  - Wall fixtures
  - Appliance plug points
  - USB outlets
- Drag existing components to reposition.
- Delete selected components with the `Delete` key.
- Orbit/pan/zoom camera in 3D.

## Run locally

Because this is a static app, you can serve it with any local web server:

```bash
python -m http.server 4173
```

Then open `http://localhost:4173`.
