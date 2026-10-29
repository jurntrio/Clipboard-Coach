# Drawings during clip creation

Each selected tag with an in-range drawing for a selected camera offers “Tekening meenemen” / “Include drawing”. It defaults to enabled each time the clip dialog opens. The choice applies to all selected cameras for that tag and never changes the saved tag or drawing.

The browser sends excludedDrawingTagIds to the existing process endpoint. After ownership, tag membership, worker capability and render-state checks, the server maps tag IDs to clip-segment IDs and stores optional excludeDrawings in the clip image manifest. The remote pipeline skips downloading and encoding drawings for those segments, including browser-uploaded local footage. Existing manifests without this field keep their original behavior. No database migration is needed.

Deploy the worker with health capability clipDrawingSelection: 1 before publishing the website. The website refuses an exclusion when an older worker cannot honor it.

Validation: node --test website/tests/clip-drawing-selection.test.cjs; website and worker TypeScript checks; existing clip-image manifest and media encoding tests.
