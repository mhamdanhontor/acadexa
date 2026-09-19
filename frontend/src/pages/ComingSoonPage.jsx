import PageHeader from '../components/PageHeader'

/** Temporary placeholder for pages not yet implemented in this build pass. */
export default function ComingSoonPage({ title }) {
  return (
    <div>
      <PageHeader title={title} />
      <div className="bg-white rounded-xl border border-gray-200 p-10 text-center text-gray-400">
        <i className="fas fa-hammer text-3xl mb-3"></i>
        <p>This page is not implemented yet in this build pass.</p>
      </div>
    </div>
  )
}
