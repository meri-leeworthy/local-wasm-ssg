import { useEffect, useRef, useState } from "react"
import { useSqlContext } from "./SqlContext.jsx"
import { Alert, AlertDescription, AlertTitle } from "./ui/alert.jsx"
import type { FileData, SelectedFiles } from "../lib/types.jsx"
import type { ParamsObject } from "sql.js"
import { useDebounce } from "@/hooks/useDebounce.js"
import useRender from "@/hooks/useRender.js"

export const Preview = ({
  selectedFiles,
  setSelectedFiles,
}: {
  selectedFiles: SelectedFiles
  setSelectedFiles: React.Dispatch<React.SetStateAction<SelectedFiles>>
}) => {
  const iframeRef = useRef<HTMLIFrameElement | null>(null)
  const [files, setFiles] = useState<Map<number, FileData>>(new Map())
  const [refresh, setRefresh] = useState<number>(0)
  const debouncedRefresh = useDebounce(refresh, 50)
  const [previewContent, setPreviewContent] = useState<string>("")

  const {
    execute,
    loading: sqlLoading,
    error: sqlError,
    schemaInitialized,
  } = useSqlContext()
  const { loading: wasmLoading, error: wasmError, renderLocal } = useRender()

  useEffect(() => {
    if (
      !schemaInitialized ||
      sqlLoading ||
      sqlError ||
      wasmLoading ||
      wasmError
    )
      return

    const fetchData = async () => {
      try {
        const query =
          "SELECT file.id, file.name, file.data, file.url, model.name as type FROM file JOIN model ON file.model_id = model.id;"
        const result = execute(query)

        const files = result.map((file: ParamsObject): [number, FileData] => [
          file.id as number,
          {
            id: file.id as number,
            name: file.name?.toString() || "",
            type: file.type?.toString() as FileData["type"],
            data: JSON.parse(file.data?.toString() || "{}"),
            url: file.url?.toString() || "",
          },
        ])

        const filesMap = new Map(files)
        setFiles(filesMap)
      } catch (err) {
        console.error("Error fetching data:", err)
      }
    }

    fetchData()
  }, [
    execute,
    sqlLoading,
    sqlError,
    schemaInitialized,
    selectedFiles,
    debouncedRefresh,
  ])

  useEffect(() => {
    if (sqlLoading || wasmLoading) return
    if (!selectedFiles.contentFileId) return

    try {
      const combinedContent = renderLocal(selectedFiles.contentFileId, files)
      setPreviewContent(combinedContent)

      if (iframeRef.current?.contentWindow) {
        iframeRef.current.contentWindow.postMessage(
          { type: "update", html: combinedContent },
          "*"
        )
      }
    } catch (e) {
      console.error("Error during conversion:", e)
      setPreviewContent("")
    }
  }, [selectedFiles, wasmLoading, files, sqlLoading, debouncedRefresh])

  // re-render on keypresses
  useEffect(() => {
    const handleKeyDown = () => {
      setRefresh(refresh => refresh + 1) // Trigger rerender by updating state
    }

    const handleClick = () => {
      setRefresh(refresh => refresh + 1)
    }

    window.addEventListener("keydown", handleKeyDown)
    window.addEventListener("click", handleClick)

    // Clean up the event listener on component unmount
    return () => {
      window.removeEventListener("keydown", handleKeyDown)
      window.removeEventListener("click", handleClick)
    }
  }, [])

  const onLinkClick = (href: string) => {
    const newFileId = [...files.values()].find(
      file => file.name === href.slice(1)
    )?.id
    if (!newFileId) {
      console.error("File not found:", href)
      return
    }
    setSelectedFiles({
      activeFileId: newFileId,
      contentFileId: newFileId,
    })
  }

  // handle link clicks inside the iframe
  const handleIframeClick = (event: MouseEvent) => {
    const target = event.target as HTMLElement

    if (target.tagName.toLowerCase() === "a") {
      const href = target.getAttribute("href")
      if (href) {
        const isInternal = href.startsWith("/")
        if (isInternal) {
          event.preventDefault()
          onLinkClick(href)
        } else {
          // Optionally handle external links, e.g., open in new tab
          // window.open(href, '_blank')
        }
      }
    }
  }
  // useEffect(() => {
  //   const iframe = iframeRef.current
  //   if (iframe && iframe.contentDocument) {
  //     iframe.contentDocument.removeEventListener("click", handleIframeClick)
  //   }
  // }, [previewContent])
  const handleIframeLoad = () => {
    const iframe = iframeRef.current
    if (!iframe?.contentWindow) return

    iframe.contentWindow.postMessage({ type: "initialize" }, "*")
  }

  return (
    <>
      {wasmError ? (
        <div className="flex items-center justify-center h-screen">
          <Alert variant="destructive">
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>{wasmError}</AlertDescription>
          </Alert>
        </div>
      ) : (
        <iframe
          ref={iframeRef}
          className="items-center w-full h-screen overflow-y-scroll border-l-1"
          id="preview-pane"
          onLoad={handleIframeLoad}
          srcDoc={`<!DOCTYPE html>
            <html>
            <head>
              <style>
                body { margin: 0; padding: 1rem; font-family: sans-serif; }
                img { max-width: 100%; height: auto; display: block; }
              </style>
              <script>
                document.addEventListener("DOMContentLoaded", () => {
                  window.morphdomReady = false;
                  function loadScript(url, callback) {
                    const script = document.createElement("script");
                    script.src = url;
                    script.onload = callback;
                    document.head.appendChild(script);
                  }
                  
                  loadScript("https://cdn.jsdelivr.net/npm/morphdom/dist/morphdom-umd.min.js", () => {
                    window.morphdomReady = true;
                  });
                });
                
                window.addEventListener("message", (event) => {
                  if (event.data.type === "update") {
                    if (!document.body) {
                      console.error("Morphdom update skipped: document.body is null");
                      console.log("document:", document)
                      return;
                    }
                    if (!event.data.html) {
                      console.error("Morphdom update skipped: event.data.html is null");
                      return;
                    }
                    if (!window.morphdomReady) {
                      console.warn("Morphdom not ready yet, update skipped");
                      return;
                    }
                    morphdom(document.body, event.data.html);
                  } else if (event.data.type === "initialize") {
                    window.morphdomReady = true;
                  }
                });
              </script>
            </head>
            <body>
              <p>Loading preview...</p>
            </body>
            </html>`}
        />
      )}
    </>
  )
}
