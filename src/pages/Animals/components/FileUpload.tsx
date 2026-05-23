import React, { useRef, useState } from 'react';
import { Upload, X, FileText, Image as ImageIcon } from 'lucide-react';
import Button from '../../../components/ui/Button';

interface FileUploadProps {
    onFilesUpload: (files: File[]) => void;
    accept?: string;
    maxSize?: number; // in bytes
}

const FileUpload: React.FC<FileUploadProps> = ({
    onFilesUpload,
    accept = '.pdf,.png,.jpg,.jpeg,.doc,.docx',
    maxSize = 10 * 1024 * 1024 // 10MB
}) => {
    const [dragActive, setDragActive] = useState(false);
    const [files, setFiles] = useState<File[]>([]);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleDrag = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        if (e.type === 'dragenter' || e.type === 'dragover') {
            setDragActive(true);
        } else if (e.type === 'dragleave') {
            setDragActive(false);
        }
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setDragActive(false);

        const droppedFiles = Array.from(e.dataTransfer.files);
        processFiles(droppedFiles);
    };

    const processFiles = (newFiles: File[]) => {
        const validFiles = newFiles.filter((file) => {
            if (file.size > maxSize) {
                alert(`${file.name} dépasse la taille limite`);
                return false;
            }
            return true;
        });

        setFiles([...files, ...validFiles]);
        onFilesUpload(validFiles);
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files) {
            processFiles(Array.from(e.target.files));
        }
    };

    const removeFile = (index: number) => {
        setFiles(files.filter((_, i) => i !== index));
    };

    const getFileIcon = (file: File) => {
        if (file.type.startsWith('image/')) {
            return <ImageIcon className="w-4 h-4" />;
        }
        return <FileText className="w-4 h-4" />;
    };

    return (
        <div className="space-y-4">
            {/* Drop Zone */}
            <div
                onDragEnter={handleDrag}
                onDragLeave={handleDrag}
                onDragOver={handleDrag}
                onDrop={handleDrop}
                className={`relative p-8 border-2 border-dashed rounded-2xl transition-all ${dragActive
                    ? 'border-primary bg-primary/5'
                    : 'border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50 hover:border-primary'
                    }`}
            >
                <input
                    ref={fileInputRef}
                    type="file"
                    multiple
                    onChange={handleChange}
                    accept={accept}
                    className="absolute inset-0 opacity-0 cursor-pointer"
                />

                <div className="text-center">
                    <Upload className="w-8 h-8 text-primary mx-auto mb-3" />
                    <p className="font-semibold text-gray-900 dark:text-white mb-1">Glissez vos fichiers ici</p>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">ou</p>
                    <Button
                        type="button"
                        variant="primary"
                        size="sm"
                        onClick={() => fileInputRef.current?.click()}
                    >
                        Sélectionner fichiers
                    </Button>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-3">
                        PDF, images, documents (max 10 MB)
                    </p>
                </div>
            </div>

            {/* File List */}
            {files.length > 0 && (
                <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 p-4">
                    <p className="text-sm font-semibold text-gray-900 dark:text-white mb-3">
                        {files.length} fichier{files.length > 1 ? 's' : ''} sélectionné{files.length > 1 ? 's' : ''}
                    </p>
                    <div className="space-y-2">
                        {files.map((file, index) => (
                            <div
                                key={`${file.name}-${index}`}
                                className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg"
                            >
                                <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 rounded-lg bg-blue-50 dark:bg-blue-500/10 flex items-center justify-center text-blue-600 dark:text-blue-400">
                                        {getFileIcon(file)}
                                    </div>
                                    <div>
                                        <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">{file.name}</p>
                                        <p className="text-xs text-gray-500 dark:text-gray-400">
                                            {(file.size / 1024).toFixed(1)} KB
                                        </p>
                                    </div>
                                </div>
                                <Button type="button" variant="ghost" size="sm" onClick={() => removeFile(index)} className="p-1 rounded-lg">
                                    <X className="w-5 h-5 text-red-600 dark:text-red-400" />
                                </Button>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};

export default FileUpload;
