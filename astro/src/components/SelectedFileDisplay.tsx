import { useEffect, useState } from "react"
import { useSqlContext } from "./SqlContext"
import type { SelectedFile } from "../lib/types"
import { Textarea } from "./ui/textarea"

export const SelectedFileDisplay = ({
  selectedFile,
}: {
  selectedFile: SelectedFile
}) => {
  const { execute, loading, error, schemaInitialized } = useSqlContext()
  const [content, setContent] = useState<string>("")

  useEffect(() => {
    if (!schemaInitialized || loading || error || !selectedFile) return

    const getSelectedFile = async (selectedFileName: string) => {
      try {
        const query = `SELECT * FROM files WHERE name = ?;`
        const result = execute(query, [selectedFileName])
        setContent(result[0]?.content?.toString() || "")
      } catch (err) {
        console.error("Error fetching file from database:", err)
      }
    }

    getSelectedFile(selectedFile.activeFile)
  }, [schemaInitialized, selectedFile?.activeFile])

  // const selectedImage =
  //   selectedFile &&
  //   !selectedFileIsText &&
  //   new Blob([selectedFile?.content], { type: "image/jpeg" }) // Change the MIME type to the correct one for your image

  // Create an object URL from the Blob
  // const url = selectedImage ? URL.createObjectURL(selectedImage) : ""

  const handleInputChange = async (
    e: React.ChangeEvent<HTMLTextAreaElement>
  ) => {
    if (!selectedFile) return
    const newContent = e.target.value
    setContent(newContent)

    const query = `
    UPDATE files
    SET content = ?
    WHERE name = ?
    AND type = ?;
    `
    try {
      execute(query, [newContent, selectedFile.activeFile, selectedFile.type])
    } catch (err) {
      console.error("Error updating content:", err)
    }
  }

  return (
    <div className="flex-1 p-2">
      {selectedFile?.type === "asset" ? (
        <img src={content} alt="Selected Asset" />
      ) : (
        <Textarea
          className="h-20 min-h-[calc(100vh-40px)] resize-none font-mono"
          placeholder="Enter your code here..."
          value={content}
          onChange={handleInputChange}
        />
      )}
    </div>
  )
}
