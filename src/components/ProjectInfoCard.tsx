import type { ProjectInfo } from "../lib/openstaad-api";

interface Props {
  info: ProjectInfo | null;
}

export function ProjectInfoCard({ info }: Props) {
  if (!info) return null;

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
      <h2 className="text-lg font-semibold text-gray-900 mb-4">Project Info</h2>
      <dl className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <dt className="text-xs font-medium text-gray-500 uppercase tracking-wider">
            Project Name
          </dt>
          <dd className="mt-1 text-sm text-gray-900 font-medium">{info.projectName}</dd>
        </div>
        <div>
          <dt className="text-xs font-medium text-gray-500 uppercase tracking-wider">
            File Path
          </dt>
          <dd className="mt-1 text-sm text-gray-700 font-mono break-all">{info.fileName}</dd>
        </div>
      </dl>
    </div>
  );
}
