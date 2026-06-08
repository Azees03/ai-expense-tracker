import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useGroups } from "../context/GroupContext";
import "./Groups.css";

export default function Groups() {
  const { groups, loading, fetchGroups, createGroup } = useGroups();
  const [showModal, setShowModal] = useState(false);
  const [newGroupName, setNewGroupName] = useState("");
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    fetchGroups();
  }, [fetchGroups]);

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!newGroupName.trim()) return;
    setCreating(true);
    try {
      await createGroup(newGroupName);
      setNewGroupName("");
      setShowModal(false);
    } catch (err) {
      console.error(err);
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="groups-page">
      <header className="page-header">
        <div>
          <h1>Groups</h1>
          <p className="subtitle">Split expenses with friends and family</p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowModal(true)}>
          <span>+</span> New Group
        </button>
      </header>

      {loading && groups.length === 0 ? (
        <div className="loading-state">
          <div className="spinner" />
          <p>Loading your groups...</p>
        </div>
      ) : groups.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">👥</div>
          <h2>No groups yet</h2>
          <p>Create a group to start splitting expenses with others.</p>
          <button className="btn btn-primary" onClick={() => setShowModal(true)}>
            Create your first group
          </button>
        </div>
      ) : (
        <div className="groups-grid">
          {groups.map((group) => (
            <Link to={`/groups/${group.id}`} key={group.id} className="group-card">
              <div className="group-icon">
                {group.name[0].toUpperCase()}
              </div>
              <div className="group-info">
                <h3>{group.name}</h3>
                <p>{group.group_members?.[0]?.count || 0} members</p>
              </div>
              <div className="group-arrow">→</div>
            </Link>
          ))}
        </div>
      )}

      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h2>Create New Group</h2>
            <form onSubmit={handleCreate}>
              <div className="form-group" style={{ marginBottom: "16px" }}>
                <label>Group Name</label>
                <input
                  type="text"
                  placeholder="e.g. Goa Trip, Flatmates"
                  value={newGroupName}
                  onChange={(e) => setNewGroupName(e.target.value)}
                  autoFocus
                  required
                />
              </div>
              <div className="modal-actions">
                <button 
                  type="button" 
                  className="btn btn-text" 
                  onClick={() => setShowModal(false)}
                  disabled={creating}
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  className="btn btn-primary"
                  disabled={creating}
                >
                  {creating ? "Creating..." : "Create Group"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
