import 'maplibre-gl/dist/maplibre-gl.css'
import { useEffect, useRef, useState } from 'react'
import Map, {
  Source,
  Layer,
  Popup,
  NavigationControl,
  AttributionControl,
  type MapLayerMouseEvent,
  type ViewStateChangeEvent,
  type MapRef,
} from 'react-map-gl/maplibre'
import type { FeatureCollection, Point, Polygon, Feature } from 'geojson'
import type { AppSearch } from '../../search-schema'
import {
  type Bbox,
  type Corner,
  isValidBbox,
  normalizeBbox,
  roundBbox,
  bboxToPolygon,
  bboxCorners,
  moveCorner,
} from '../../lib/bbox'
import type { Deletion } from '../../lib/ohsome'
import { osmHistoryUrl, osmChangesetUrl } from '../../lib/osm'

// OpenFreeMap basemap (Maptiler is the documented fallback if this is ever down).
const MAP_STYLE = 'https://tiles.openfreemap.org/styles/liberty'
const HANDLE_LAYER = 'bbox-handles'
const DELETION_LAYER = 'deletions'

interface Props {
  search: AppSearch
  deletions: Deletion[]
  hoveredId: string | null
  selectedId: string | null
  onHover: (osmId: string | null) => void
  onSelect: (osmId: string | null) => void
  drawing: boolean
  onDrawingChange: (drawing: boolean) => void
  onBboxChange: (bbox: Bbox) => void
  onCameraChange: (cam: { z: number; lat: number; lng: number }) => void
}

const round = (n: number, dp: number) => Number(n.toFixed(dp))

export function AreaMap({
  search,
  deletions,
  hoveredId,
  selectedId,
  onHover,
  onSelect,
  drawing,
  onDrawingChange,
  onBboxChange,
  onCameraChange,
}: Props) {
  const committedBbox =
    search.bbox && isValidBbox(search.bbox as Bbox) ? (search.bbox as Bbox) : null

  // Draft shown live while drawing/dragging; committed to the URL on mouse-up.
  const [draftBbox, setDraftBbox] = useState<Bbox | null>(null)

  const cornerRef = useRef<Corner | null>(null)
  const drawStartRef = useRef<[number, number] | null>(null)
  const baseRef = useRef<Bbox | null>(null)
  const mapRef = useRef<MapRef | null>(null)

  const effectiveBbox = draftBbox ?? committedBbox
  const activeId = hoveredId ?? selectedId
  const selected = deletions.find((d) => d.osmId === selectedId) ?? null

  // Bring a selected, located deletion into view.
  useEffect(() => {
    if (!selected || selected.lon === undefined || selected.lat === undefined) return
    mapRef.current?.getMap().easeTo({ center: [selected.lon, selected.lat], duration: 400 })
  }, [selected])

  const [initialView] = useState(() => initialViewState(search))

  const setPan = (enabled: boolean) => {
    const map = mapRef.current?.getMap()
    if (!map) return
    if (enabled) map.dragPan.enable()
    else map.dragPan.disable()
  }

  const onMouseDown = (e: MapLayerMouseEvent) => {
    const handle = e.features?.find((f) => f.layer.id === HANDLE_LAYER)
    if (handle) {
      cornerRef.current = handle.properties?.corner as Corner
      baseRef.current = committedBbox
      setPan(false)
      e.preventDefault()
      return
    }
    if (drawing) {
      drawStartRef.current = [e.lngLat.lng, e.lngLat.lat]
      setPan(false)
      e.preventDefault()
    }
  }

  const onMouseMove = (e: MapLayerMouseEvent) => {
    if (cornerRef.current && baseRef.current) {
      setDraftBbox(moveCorner(baseRef.current, cornerRef.current, e.lngLat.lng, e.lngLat.lat))
      return
    }
    if (drawing && drawStartRef.current) {
      const [lng0, lat0] = drawStartRef.current
      setDraftBbox(normalizeBbox([lng0, lat0, e.lngLat.lng, e.lngLat.lat]))
      return
    }
    // Hover-link deletion markers to the table.
    const hit = e.features?.find((f) => f.layer.id === DELETION_LAYER)
    onHover((hit?.properties?.osmId as string | undefined) ?? null)
  }

  const finishInteraction = () => {
    if (draftBbox) onBboxChange(roundBbox(normalizeBbox(draftBbox)))
    cornerRef.current = null
    drawStartRef.current = null
    baseRef.current = null
    setDraftBbox(null)
    onDrawingChange(false)
    setPan(true)
  }

  const onMouseUp = () => {
    if (cornerRef.current || drawStartRef.current) finishInteraction()
  }

  const onClick = (e: MapLayerMouseEvent) => {
    const hit = e.features?.find((f) => f.layer.id === DELETION_LAYER)
    if (hit) onSelect((hit.properties?.osmId as string | undefined) ?? null)
  }

  const interactiveLayerIds = [HANDLE_LAYER, DELETION_LAYER]

  return (
    <div className="absolute inset-0">
      <Map
        ref={mapRef}
        initialViewState={initialView}
        mapStyle={MAP_STYLE}
        attributionControl={false}
        interactiveLayerIds={interactiveLayerIds}
        cursor={drawing ? 'crosshair' : hoveredId ? 'pointer' : undefined}
        onMouseLeave={() => onHover(null)}
        onMoveEnd={(e: ViewStateChangeEvent) =>
          onCameraChange({
            z: round(e.viewState.zoom, 2),
            lat: round(e.viewState.latitude, 5),
            lng: round(e.viewState.longitude, 5),
          })
        }
        onMouseDown={onMouseDown}
        onMouseMove={onMouseMove}
        onMouseUp={onMouseUp}
        onClick={onClick}
      >
        <NavigationControl position="top-right" />
        <AttributionControl position="bottom-right" compact />

        {effectiveBbox && isValidBbox(normalizeBbox(effectiveBbox)) && (
          <Source id="bbox" type="geojson" data={polygonFc(bboxToPolygon(effectiveBbox))}>
            <Layer
              id="bbox-fill"
              type="fill"
              paint={{ 'fill-color': '#ea580c', 'fill-opacity': 0.08 }}
            />
            <Layer
              id="bbox-line"
              type="line"
              paint={{ 'line-color': '#ea580c', 'line-width': 2 }}
            />
          </Source>
        )}

        {effectiveBbox && (
          <Source id="handles" type="geojson" data={handlesFc(effectiveBbox)}>
            <Layer
              id={HANDLE_LAYER}
              type="circle"
              paint={{
                'circle-radius': 6,
                'circle-color': '#ffffff',
                'circle-stroke-color': '#ea580c',
                'circle-stroke-width': 2,
              }}
            />
          </Source>
        )}

        {deletions.length > 0 && (
          <Source id="deletions" type="geojson" data={deletionsFc(deletions)}>
            <Layer
              id={DELETION_LAYER}
              type="circle"
              paint={{
                'circle-radius': 6,
                'circle-color': '#dc2626',
                'circle-stroke-color': '#ffffff',
                'circle-stroke-width': 1.5,
              }}
            />
            {/* Highlight the row/marker the user is hovering or has selected. */}
            <Layer
              id="deletions-active"
              type="circle"
              filter={['==', ['get', 'osmId'], activeId ?? '']}
              paint={{
                'circle-radius': 9,
                'circle-color': '#f59e0b',
                'circle-stroke-color': '#ffffff',
                'circle-stroke-width': 2,
              }}
            />
          </Source>
        )}

        {selected && selected.lon !== undefined && selected.lat !== undefined && (
          <Popup
            longitude={selected.lon}
            latitude={selected.lat}
            anchor="bottom"
            onClose={() => onSelect(null)}
            closeOnClick={false}
          >
            <div className="min-w-[12rem] text-xs leading-5">
              <div className="font-mono font-medium">
                {selected.ref ? (
                  <a
                    className="text-blue-600 underline"
                    href={osmHistoryUrl(selected.ref, { lat: selected.lat, lon: selected.lon })}
                    target="_blank"
                    rel="noreferrer"
                  >
                    {selected.osmId}
                  </a>
                ) : (
                  selected.osmId
                )}
              </div>
              <dl className="mt-1 grid grid-cols-[auto_1fr] gap-x-2">
                <dt className="text-gray-500">Deleted</dt>
                <dd>{(selected.timestamp ?? '').slice(0, 10) || '—'}</dd>
                <dt className="text-gray-500">Changeset</dt>
                <dd>
                  {selected.changesetId !== undefined ? (
                    <a
                      className="text-blue-600 underline"
                      href={osmChangesetUrl(selected.changesetId)}
                      target="_blank"
                      rel="noreferrer"
                    >
                      {selected.changesetId}
                    </a>
                  ) : (
                    '—'
                  )}
                </dd>
              </dl>
              <div className="mt-1">
                <div className="text-gray-500">Tags</div>
                {Object.keys(selected.tags).length > 0 ? (
                  <ul className="font-mono">
                    {Object.entries(selected.tags).map(([k, v]) => (
                      <li key={k}>
                        {k}={v}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <span>—</span>
                )}
              </div>
            </div>
          </Popup>
        )}
      </Map>

      {/* Draw-mode hint (the trigger lives in the form's step 2) */}
      {drawing && (
        <div className="pointer-events-none absolute top-2 left-1/2 -translate-x-1/2 rounded bg-orange-600 px-3 py-1.5 text-sm font-medium text-white shadow">
          Click and drag to draw the area
        </div>
      )}
    </div>
  )
}

function initialViewState(search: AppSearch) {
  if (search.z !== undefined && search.lat !== undefined && search.lng !== undefined) {
    return { zoom: search.z, latitude: search.lat, longitude: search.lng }
  }
  const b = search.bbox as Bbox | undefined
  if (b && isValidBbox(b)) {
    return { zoom: 14, latitude: (b[1] + b[3]) / 2, longitude: (b[0] + b[2]) / 2 }
  }
  // Default: a wide view of Germany so the user can navigate to their area.
  return { zoom: 5, latitude: 51.2, longitude: 10.4 }
}

function polygonFc(feature: Feature<Polygon>): FeatureCollection<Polygon> {
  return { type: 'FeatureCollection', features: [feature] }
}

function handlesFc(bbox: Bbox): FeatureCollection<Point> {
  return {
    type: 'FeatureCollection',
    features: bboxCorners(bbox).map((c) => ({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [c.lon, c.lat] },
      properties: { corner: c.corner },
    })),
  }
}

function deletionsFc(deletions: Deletion[]): FeatureCollection<Point> {
  return {
    type: 'FeatureCollection',
    features: deletions
      .filter((d) => d.lon !== undefined && d.lat !== undefined)
      .map((d) => ({
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [d.lon!, d.lat!] },
        properties: { osmId: d.osmId },
      })),
  }
}
