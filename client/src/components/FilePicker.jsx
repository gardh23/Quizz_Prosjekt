// The native file input shows the browser's own English "Choose File / No file chosen".
// It stays in the DOM (sr-only) for keyboard and screen readers, behind a Norwegian button.
function FilePicker({ accept, label, file, onChange }) {
    return (
        <label className="flex items-center gap-3">
            <input
                type="file"
                accept={accept}
                onChange={e => onChange(e.target.files[0] || null)}
                className="sr-only peer"
            />
            <span className="btn btn-soft px-4 py-2 peer-focus-visible:ring-4 peer-focus-visible:ring-yellow-400">{label}</span>
            <span className="text-sm text-gray-500 truncate">{file ? file.name : 'Ingen fil valgt'}</span>
        </label>
    )
}

export default FilePicker
